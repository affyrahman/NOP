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



// Serve static assets from project root
app.use(express.static(__dirname));

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
