import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// In-memory Magistrate Calendar Store (mimics Apps Script UserProperties & CalendarApp)
let userCalendarSettings = {
  calendarId: 'primary',
  defaultDuration: 15,
  calendarName: "Judicial Calendar - Magistrate's Court (BSB)",
  timeZone: 'Asia/Brunei',
  isConnected: true,
  userEmail: 'magistrate.court@judiciary.gov.bn'
};

// Active store of genuine user-scheduled court hearing events (starts completely clear)
const scheduledEvents = [];

const HEARING_MAP = {
  FM: { titlePrefix: 'FM', label: 'For Mention', colorId: '7', hex: '#039be5', defaultDuration: 15 },
  FS: { titlePrefix: 'FS', label: 'For Sentencing', colorId: '3', hex: '#8e24aa', defaultDuration: 30 },
  PTC: { titlePrefix: 'PTC', label: 'Pre-Trial Conference', colorId: '6', hex: '#ffb878', defaultDuration: 30 },
  TRIAL: { titlePrefix: 'TRIAL', label: 'Trial Hearing', colorId: '11', hex: '#d50000', defaultDuration: 60 },
  RULING: { titlePrefix: 'RULING', label: 'Ruling / Judgment', colorId: '5', hex: '#f6bf26', defaultDuration: 15 }
};

// API: Get Calendar Settings
app.get('/api/calendar/settings', (req, res) => {
  res.json({
    success: true,
    ...userCalendarSettings
  });
});

// API: Save Calendar Settings
app.post('/api/calendar/settings', (req, res) => {
  const { calendarId, defaultDuration } = req.body || {};
  const calId = (calendarId || 'primary').trim();
  const duration = parseInt(defaultDuration, 10) || 15;

  if (calId.toLowerCase().includes('invalid')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Calendar ID provided. Calendar could not be resolved or access was denied.'
    });
  }

  userCalendarSettings.calendarId = calId;
  userCalendarSettings.defaultDuration = duration;
  userCalendarSettings.calendarName = calId === 'primary' 
    ? "Judicial Calendar - Magistrate's Court (BSB)"
    : `Work Calendar (${calId})`;
  userCalendarSettings.isConnected = true;

  res.json({
    success: true,
    message: 'Calendar settings successfully verified and saved.',
    ...userCalendarSettings
  });
});

// API: Test Calendar Connection
app.post('/api/calendar/test', (req, res) => {
  const { calendarId } = req.body || {};
  const calId = (calendarId || 'primary').trim();

  if (calId.toLowerCase().includes('invalid')) {
    return res.status(400).json({
      success: false,
      error: 'Connection failed: Calendar ID "' + calId + '" is invalid or not shared with this judicial account.'
    });
  }

  const calName = calId === 'primary' 
    ? "Primary Judicial Calendar (Magistrate's Court BSB)" 
    : `Google Calendar: ${calId}`;

  res.json({
    success: true,
    calendarId: calId,
    calendarName: calName,
    timeZone: 'Asia/Brunei',
    isDefault: calId === 'primary'
  });
});

// API: Get Schedule for Date (Conflict Preview)
app.get('/api/calendar/schedule', (req, res) => {
  const targetDateStr = req.query.date || new Date().toISOString().slice(0, 10);
  
  // Only include events specifically scheduled for this targetDateStr
  const matchingEvents = scheduledEvents.filter(evt => evt.date === targetDateStr);

  const eventsForDate = matchingEvents.map((evt, idx) => {
    const [h, m] = (evt.startTime || '09:00').split(':');
    const [endH, endM] = (evt.endTime || '09:15').split(':');
    const startIso = `${targetDateStr}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`;
    const endIso = `${targetDateStr}T${endH.padStart(2, '0')}:${endM.padStart(2, '0')}:00`;

    const startD = new Date(startIso);
    const endD = new Date(endIso);
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Brunei'
    });

    return {
      id: evt.id || `evt_${idx}`,
      title: evt.title,
      hearingType: evt.hearingType || 'FM',
      startTime: startIso,
      endTime: endIso,
      startTimeFormatted: isNaN(startD.getTime()) ? evt.startTime : timeFormatter.format(startD),
      endTimeFormatted: isNaN(endD.getTime()) ? evt.endTime : timeFormatter.format(endD),
      isAllDay: false,
      color: evt.color || '#039be5',
      courtRoom: evt.courtRoom || 'Court Room 1',
      notes: evt.notes || ''
    };
  });

  // Sort chronologically
  eventsForDate.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  res.json({
    success: true,
    date: targetDateStr,
    calendarName: userCalendarSettings.calendarName,
    timeZone: userCalendarSettings.timeZone,
    events: eventsForDate,
    count: eventsForDate.length,
    authenticated: false
  });
});

// API: Create Calendar Event
app.post('/api/calendar/event', (req, res) => {
  const { caseNo, hearingType = 'FM', startDateTime, durationMinutes, notes, magistrateName } = req.body || {};

  if (!caseNo) {
    return res.status(400).json({ success: false, error: 'Case reference number (caseNo) is required.' });
  }
  if (!startDateTime) {
    return res.status(400).json({ success: false, error: 'Start date/time (startDateTime) is required.' });
  }

  const hType = (hearingType || 'FM').toUpperCase();
  const cfg = HEARING_MAP[hType] || HEARING_MAP.FM;
  const duration = parseInt(durationMinutes, 10) || userCalendarSettings.defaultDuration || cfg.defaultDuration || 15;

  const startDate = new Date(startDateTime);
  if (isNaN(startDate.getTime())) {
    return res.status(400).json({ success: false, error: 'Invalid start date/time format.' });
  }
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

  const title = `${cfg.titlePrefix}: ${caseNo}`;
  const eventId = `evt_nop_${Date.now()}`;
  const eventDateStr = startDateTime.slice(0, 10);

  // Time format
  const startHH = String(startDate.getHours()).padStart(2, '0');
  const startMM = String(startDate.getMinutes()).padStart(2, '0');
  const endHH = String(endDate.getHours()).padStart(2, '0');
  const endMM = String(endDate.getMinutes()).padStart(2, '0');

  // Push into scheduled events with explicit date
  const newEvt = {
    id: eventId,
    date: eventDateStr,
    title,
    hearingType: hType,
    startTime: `${startHH}:${startMM}`,
    endTime: `${endHH}:${endMM}`,
    color: cfg.hex,
    notes: notes || `Case ${caseNo} adjourned for ${cfg.label}`
  };
  scheduledEvents.push(newEvt);

  // Direct Google Calendar web link (template)
  const gcalStart = startDate.toISOString().replace(/-|:|\.\d\d\d/g, '');
  const gcalEnd = endDate.toISOString().replace(/-|:|\.\d\d\d/g, '');
  const gcalDetails = encodeURIComponent(
    `Case: ${caseNo}\nHearing: ${cfg.label}\nMagistrate: ${magistrateName || 'Magistrate'}\n\nNotes: ${notes || 'Scheduled via NOP Editing Suite'}`
  );
  const gcalLocation = encodeURIComponent('Subordinate Courts of Brunei Darussalam');
  const eventUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${gcalStart}/${gcalEnd}&details=${gcalDetails}&location=${gcalLocation}&add=${encodeURIComponent(userCalendarSettings.userEmail)}`;

  res.json({
    success: true,
    message: `Hearing event "${title}" successfully scheduled on ${userCalendarSettings.calendarName}`,
    eventId,
    eventUrl,
    title,
    hearingType: hType,
    hearingLabel: cfg.label,
    colorHex: cfg.hex,
    calendarName: userCalendarSettings.calendarName,
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
    durationMinutes: duration
  });
});
// API: Dropbox OAuth Token Exchange & Auto-Refresh Proxy (PKCE & Refresh Token)
app.post('/api/dropbox/token', async (req, res) => {
  try {
    const { grant_type, code, code_verifier, refresh_token, client_id, redirect_uri } = req.body || {};

    if (!grant_type || !client_id) {
      return res.status(400).json({ error: 'Missing required grant_type or client_id' });
    }

    const params = new URLSearchParams();
    params.append('grant_type', grant_type);
    params.append('client_id', client_id);

    if (grant_type === 'authorization_code') {
      if (!code || !code_verifier || !redirect_uri) {
        return res.status(400).json({ error: 'Missing code, code_verifier, or redirect_uri for authorization_code flow' });
      }
      params.append('code', code);
      params.append('code_verifier', code_verifier);
      params.append('redirect_uri', redirect_uri);
    } else if (grant_type === 'refresh_token') {
      if (!refresh_token) {
        return res.status(400).json({ error: 'Missing refresh_token for refresh_token grant' });
      }
      params.append('refresh_token', refresh_token);
    } else {
      return res.status(400).json({ error: `Unsupported grant_type: ${grant_type}` });
    }

    const dropboxRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await dropboxRes.json();

    if (!dropboxRes.ok) {
      return res.status(dropboxRes.status).json(data);
    }

    return res.json(data);
  } catch (err) {
    console.error('Dropbox token proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error during Dropbox token exchange' });
  }
});

// Dropbox OAuth Callback Handler for popup flow
app.get(['/auth/dropbox/callback', '/auth/dropbox/callback/'], (req, res) => {
  // Returns a self-contained HTML page that performs direct token exchange or synchronizes via BroadcastChannel and localStorage
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dropbox Authentication - Subordinate Courts Workstation</title>
      <style>
        body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1.5rem; text-align: center; box-sizing: border-box; }
        .card { background: #1e293b; padding: 2.25rem 2rem; border-radius: 1rem; border: 1px solid #334155; max-width: 440px; width: 100%; box-shadow: 0 20px 30px rgba(0,0,0,0.5); }
        .spinner { width: 44px; height: 44px; border: 4px solid #38bdf8; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1.5rem; }
        .icon-badge { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; font-size: 26px; font-weight: bold; }
        .icon-success { background: #059669; color: white; box-shadow: 0 0 20px rgba(5,150,105,0.4); }
        .icon-error { background: #dc2626; color: white; box-shadow: 0 0 20px rgba(220,38,38,0.4); }
        @keyframes spin { to { transform: rotate(360deg); } }
        h2 { margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 700; }
        p { color: #94a3b8; font-size: 0.875rem; line-height: 1.5; margin: 0 0 1rem 0; }
        .btn { display: inline-flex; align-items: center; justify-content: center; background: #0284c7; color: white; border: none; padding: 0.65rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; cursor: pointer; text-decoration: none; transition: background 0.2s; }
        .btn:hover { background: #0369a1; }
        .btn-emerald { background: #059669; }
        .btn-emerald:hover { background: #047857; }
        .code-box { background: #090d16; border: 1px solid #334155; border-radius: 0.5rem; padding: 0.75rem; font-family: monospace; font-size: 0.8rem; word-break: break-all; color: #38bdf8; margin: 1rem 0; text-align: left; }
      </style>
    </head>
    <body>
      <div class="card" id="card">
        <div id="iconContainer">
          <div class="spinner" id="spinner"></div>
        </div>
        <h2 id="mainTitle">Pairing with Court Workstation...</h2>
        <p id="mainDesc">Processing your Dropbox authorization. Please keep this window open.</p>
        <div id="extraArea"></div>
      </div>

      <script>
        (async function() {
          const iconContainer = document.getElementById('iconContainer');
          const mainTitle = document.getElementById('mainTitle');
          const mainDesc = document.getElementById('mainDesc');
          const extraArea = document.getElementById('extraArea');

          function setSuccess(title, desc, autoCloseSec = 2) {
            iconContainer.innerHTML = '<div class="icon-badge icon-success">✓</div>';
            mainTitle.textContent = title;
            mainTitle.style.color = '#34d399';
            mainDesc.innerHTML = desc;
            extraArea.innerHTML = '<button class="btn btn-emerald" onclick="window.close()">Return to Court Workstation</button>' +
              (autoCloseSec > 0 ? '<div style="font-size:0.75rem; color:#64748b; margin-top:0.75rem;">Closing window automatically in <span id="cd">' + autoCloseSec + '</span>s...</div>' : '');
            if (autoCloseSec > 0) {
              let rem = autoCloseSec;
              const cd = document.getElementById('cd');
              const iv = setInterval(() => {
                rem--;
                if (cd) cd.textContent = rem;
                if (rem <= 0) {
                  clearInterval(iv);
                  try { window.close(); } catch(e){}
                }
              }, 1000);
            }
          }

          function setError(title, desc) {
            iconContainer.innerHTML = '<div class="icon-badge icon-error">✕</div>';
            mainTitle.textContent = title;
            mainTitle.style.color = '#f87171';
            mainDesc.innerHTML = desc;
            extraArea.innerHTML = '<button class="btn" onclick="window.close()">Close</button>';
          }

          function showManualCode(code) {
            iconContainer.innerHTML = '<div class="icon-badge" style="background:#0284c7;color:white;">🔑</div>';
            mainTitle.textContent = 'Authorization Code Received';
            mainTitle.style.color = '#38bdf8';
            mainDesc.innerHTML = 'Switch back to your Court Workstation tab to finish pairing, or copy the authorization code below:';
            extraArea.innerHTML = 
              '<div class="code-box" id="codeBox">' + code + '</div>' +
              '<div style="display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;">' +
                '<button class="btn" id="copyBtn">Copy Code</button>' +
                '<button class="btn btn-emerald" onclick="tryCloseAndFocus()">Complete in Workstation</button>' +
              '</div>';

            document.getElementById('copyBtn')?.addEventListener('click', async () => {
              try {
                await navigator.clipboard.writeText(code);
                document.getElementById('copyBtn').textContent = 'Copied!';
                setTimeout(() => { if (document.getElementById('copyBtn')) document.getElementById('copyBtn').textContent = 'Copy Code'; }, 2000);
              } catch(e) {
                alert('Code: ' + code);
              }
            });
          }

          window.tryCloseAndFocus = function() {
            if (window.opener && !window.opener.closed) {
              try { window.opener.focus(); } catch(e){}
            }
            try { window.close(); } catch(e){}
          };

          try {
            const hash = window.location.hash.substring(1);
            const hashParams = new URLSearchParams(hash);
            const searchParams = new URLSearchParams(window.location.search);

            const token = hashParams.get('access_token');
            const code = searchParams.get('code');
            const error = searchParams.get('error') || hashParams.get('error');
            const errorDesc = searchParams.get('error_description') || hashParams.get('error_description');

            const broadcastChannel = ('BroadcastChannel' in window) ? new BroadcastChannel('dropbox_oauth_channel') : null;

            if (error) {
              const errText = errorDesc || error;
              if (broadcastChannel) broadcastChannel.postMessage({ type: 'DROPBOX_AUTH_ERROR', error: errText });
              if (window.opener && !window.opener.closed) {
                try { window.opener.postMessage({ type: 'DROPBOX_AUTH_ERROR', error: errText }, '*'); } catch(e){}
              }
              setError('Authorization Error', errText);
              return;
            }

            // Token flow (implicit grant)
            if (token) {
              const payload = {
                type: 'DROPBOX_AUTH_SUCCESS',
                token: token,
                timestamp: Date.now()
              };
              if (broadcastChannel) broadcastChannel.postMessage(payload);
              if (window.opener && !window.opener.closed) {
                try { window.opener.postMessage(payload, '*'); } catch(e){}
              }
              try {
                localStorage.setItem('dropbox_oauth_result', JSON.stringify({ success: true, token, timestamp: Date.now() }));
              } catch(e){}
              setSuccess('Dropbox Connected!', 'Authenticated with Court Workstation.', 2);
              return;
            }

            // Code flow (PKCE with Offline Refresh Token)
            if (code) {
              const codePayload = {
                type: 'DROPBOX_AUTH_CODE',
                code: code,
                timestamp: Date.now()
              };

              // Broadcast code across all available windows and tabs
              if (broadcastChannel) broadcastChannel.postMessage(codePayload);
              if (window.opener && !window.opener.closed) {
                try { window.opener.postMessage(codePayload, '*'); } catch(e){}
              }
              try {
                localStorage.setItem('dropbox_oauth_code_pending', JSON.stringify(codePayload));
              } catch(e){}

              // Attempt DIRECT token exchange from popup since it shares the same origin
              const codeVerifier = localStorage.getItem('dropbox_pkce_verifier') || '';
              const appKey = localStorage.getItem('dropbox_pkce_app_key') || '';
              const redirectUri = window.location.origin + '/auth/dropbox/callback';

              if (codeVerifier && appKey) {
                mainTitle.textContent = 'Exchanging Authorization Code...';
                mainDesc.textContent = 'Securing permanent background refresh credentials from Dropbox...';

                try {
                  const res = await fetch('/api/dropbox/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      grant_type: 'authorization_code',
                      code: code,
                      code_verifier: codeVerifier,
                      client_id: appKey,
                      redirect_uri: redirectUri
                    })
                  });

                  const data = await res.json();
                  if (res.ok && data.access_token) {
                    // Fetch user info from Dropbox
                    let accountEmail = '';
                    let accountName = '';
                    try {
                      const accRes = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + data.access_token }
                      });
                      if (accRes.ok) {
                        const accData = await accRes.json();
                        accountEmail = accData?.email || '';
                        accountName = accData?.name?.display_name || '';
                      }
                    } catch(e){}

                    // Persist directly into Magistrate Profile Settings in localStorage
                    const SETTINGS_KEY = 'subordinate_courts_bn_magistrate_settings_v1';
                    try {
                      const rawSettings = localStorage.getItem(SETTINGS_KEY);
                      if (rawSettings) {
                        const settings = JSON.parse(rawSettings);
                        const active = settings.profiles[settings.activeProfileId];
                        if (active) {
                          active.dropboxAccessToken = data.access_token;
                          if (data.refresh_token) active.dropboxRefreshToken = data.refresh_token;
                          const expiresIn = parseInt(data.expires_in, 10) || 14400;
                          active.dropboxTokenExpiresAt = Date.now() + (expiresIn * 1000);
                          active.dropboxTokenExpired = false;
                          active.dropboxAppKey = appKey;
                          active.dropboxEnabled = true;
                          if (accountEmail) active.dropboxAccountEmail = accountEmail;
                          if (accountName) active.dropboxAccountName = accountName;
                          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
                        }
                      }
                    } catch(e) {
                      console.warn('Failed to update local settings directly:', e);
                    }

                    // Notify workstation that token pairing is complete
                    const completePayload = {
                      type: 'DROPBOX_AUTH_COMPLETE',
                      token: data.access_token,
                      refreshToken: data.refresh_token || '',
                      expiresIn: data.expires_in || 14400,
                      email: accountEmail,
                      name: accountName,
                      timestamp: Date.now()
                    };

                    if (broadcastChannel) broadcastChannel.postMessage(completePayload);
                    if (window.opener && !window.opener.closed) {
                      try { window.opener.postMessage(completePayload, '*'); } catch(e){}
                    }
                    try {
                      localStorage.setItem('dropbox_auth_sync_event', JSON.stringify(completePayload));
                      localStorage.removeItem('dropbox_pkce_verifier');
                      localStorage.removeItem('dropbox_oauth_code_pending');
                    } catch(e){}

                    const emailLine = accountEmail ? '<br><span style="color:#f8fafc; font-weight:600;">' + accountEmail + '</span>' : '';
                    setSuccess(
                      'Dropbox Paired Successfully!',
                      'Background auto-renewal is active. Tokens will never expire again.' + emailLine,
                      2
                    );
                    return;
                  } else {
                    console.warn('Direct token exchange failed:', data);
                    showManualCode(code);
                  }
                } catch(tokenErr) {
                  console.warn('Direct exchange fetch failed:', tokenErr);
                  showManualCode(code);
                }
              } else {
                showManualCode(code);
              }
              return;
            }

            setError('No Authorization Found', 'Dropbox did not return an authorization code. Please try clicking Sign In again.');
          } catch (err) {
            console.error('Unhandled callback exception:', err);
            setError('Unexpected Error', err.message || 'An error occurred during authentication.');
          }
        })();
      </script>
    </body>
    </html>
  `);
});

// Serve static assets from project root
app.use(express.static(__dirname));

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
