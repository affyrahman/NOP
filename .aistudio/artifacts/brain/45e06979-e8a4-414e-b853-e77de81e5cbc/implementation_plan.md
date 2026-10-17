# Implementation Plan: Automatic Background Dropbox Token Renewal (OAuth 2.0 PKCE)

This plan outlines the architecture and implementation to allow the Court Workstation to automatically and silently obtain fresh Dropbox access tokens in the background, eliminating the need for the Magistrate to manually copy and paste tokens every 4 hours.

---

## 1. Core Architecture & Workflow

### A. The PKCE (Proof Key for Code Exchange) Authorization Flow
Standard developer tokens (`sl...`) only provide short-lived access without a refresh mechanism. By implementing **OAuth 2.0 PKCE with offline access**:
1. **Initiate Sign-In**:
   - The user inputs their Dropbox **App Key** once (or uses the default court app key).
   - The workstation generates a secure cryptographic `code_verifier` and SHA-256 `code_challenge`.
   - Opens a popup to Dropbox's authorization URL with `response_type=code`, `token_access_type=offline`, and `code_challenge_method=S256`.
2. **Authorization Code Exchange**:
   - Once approved, the popup redirects to `/auth/dropbox/callback` with an authorization `code`.
   - The workstation exchanges the `code` and `code_verifier` with Dropbox's `/oauth2/token` endpoint.
   - Dropbox returns both an **`access_token`** (valid for 4 hours) AND a permanent **`refresh_token`**.
3. **Storage**:
   - The active Magistrate profile saves `dropboxRefreshToken`, `dropboxAccessToken`, `dropboxTokenExpiresAt` (epoch timestamp), and `dropboxAccountEmail`.

### B. Silent Background Refresh Engine (`ensureFreshDropboxToken()`)
Before any file upload or sync operation (`syncBothToDropbox`):
1. **Check Expiration**:
   - If `dropboxRefreshToken` is present and `Date.now() >= dropboxTokenExpiresAt - 300000` (within 5 minutes of expiry):
2. **Silent Refresh Request**:
   - Sends a background refresh request with `grant_type=refresh_token&refresh_token=...&client_id=...` directly (or via `/api/dropbox/refresh`).
   - Receives a fresh `access_token` and updated `expires_in`.
   - Updates local storage and continues the sync operation seamlessly with zero prompts or toasts.
3. **Resilient Retry**:
   - If an upload ever encounters a `401` or `expired_access_token/` error despite timestamp checks, it automatically triggers an immediate background refresh and retries the upload once before reporting any error.

---

## 2. File & Component Changes

### 1. `server.js` (Backend API & OAuth Proxy)
- **`/api/dropbox/token`**:
  - Node.js endpoint to exchange authorization code for tokens and handle refresh token requests using `fetch` to Dropbox OAuth endpoint.
  - Ensures robust handling across network environments without CORS restrictions.
- **`/auth/dropbox/callback`**:
  - Update callback handler to handle both `code` and `access_token` callback parameters and send `DROPBOX_AUTH_CODE` via `postMessage`.

### 2. `index.html` (Frontend Client & UI)
- **PKCE Utility Functions**:
  - `generateCodeVerifier()`: Generates cryptographically random 43–128 character base64url string.
  - `generateCodeChallenge(verifier)`: Computes SHA-256 hash formatted as URL-safe base64.
- **Token Manager**:
  - `ensureFreshDropboxToken()`: Asynchronous helper that returns a valid access token, auto-refreshing in the background if expired.
  - `refreshDropboxAccessToken(profile)`: Handles the refresh exchange and updates profile credentials.
- **`syncBothToDropbox()`**:
  - Calls `await ensureFreshDropboxToken()` prior to calling `uploadFileToDropbox`.
  - On 401, auto-refreshes and retries the upload once before falling back to manual recovery.
- **Settings Modal UI**:
  - Update Dropbox status badge to indicate **"Auto-Renew Enabled"** (Green Shield) when a refresh token is present.
  - Provide a clear, one-click **"Pair via Browser (Auto-Renews Forever)"** button.
  - Display token lifespan and auto-renewal health status in the troubleshooting guide.

---

## 3. Verification & Testing Plan

1. **OAuth Flow Verification**:
   - Test one-click pairing popup with PKCE and confirm retrieval of `refresh_token`.
2. **Background Refresh Simulation**:
   - Set `dropboxTokenExpiresAt` to a past timestamp or set `dropboxAccessToken` to an expired token string.
   - Trigger `syncBothToDropbox()` and verify that the workstation silently acquires a new token and completes file upload without manual intervention.
3. **Fallback Handling**:
   - Ensure users who still use legacy manual tokens retain the quick-update modal if they have not yet connected via browser OAuth.
4. **Build & Lint Verification**:
   - Run `compile_applet` and `lint_applet` to ensure full code integrity.
