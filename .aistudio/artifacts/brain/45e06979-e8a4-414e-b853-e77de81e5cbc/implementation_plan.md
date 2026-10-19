# Streamlined Magistrate Settings Layout Plan

Compact, user-friendly re-architecture of the Magistrate Profile & Court Settings modal to eliminate vertical scrolling sprawl, organize controls into a natural judicial workflow, and replace verbose repetitive banners with clean, professional UI components.

## User Review & Critical Decisions

> [!IMPORTANT]
> The architectural decisions below directly reflect the user's confirmed choices from Phase 1 clarification:

- **Confirmed Decision 1 (Navigation Structure)**: Segmented top category tabs (`Courtroom & Profile`, `Documents & Signature`, `Cloud & Integrations`) to replace the long vertical scrolling modal body.
- **Confirmed Decision 2 (Logical Ordering)**: Group 1: Magistrate profile, courtroom venue, and typing focus; Group 2: Document naming templates, live file preview, and digital signature; Group 3: Google Calendar and Dropbox sync.
- **Confirmed Decision 3 (Cloud Services Presentation)**: Clean, high-density status summary cards with expand-on-click configuration panels for Dropbox and Google Calendar, removing redundant marketing text.
- **Confirmed Decision 4 (Zero Feature Loss)**: Every input, modal state, PKCE auto-renew flow, manual token fallback, JSON profile import/export, and folder preview hook is preserved with identical DOM element IDs.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms the oversized, multi-page scrolling settings modal into an ultra-compact, high-efficiency judicial control panel. Magistrates can configure courtroom identity, document export conventions, and court calendar/cloud syncing in three focused, cleanly organized tabs.
- **Target Audience / Persona**: Magistrates and court clerks in the Subordinate Courts of Brunei Darussalam who need quick access to courtroom configurations, profile backups, and sync diagnostics without visual clutter or wall-of-text instructions.
- **Key Value**: Drastically reduces modal height from ~1400px of scrolling content to a stable, compact ~440px viewable workspace, eliminating unnecessary scrolling and cognitive friction.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Modal Open & Default Tab**:
   Clicking the Settings gear or profile chip opens the modal on the **Courtroom & Profile** tab. The active profile switcher, magistrate title, district, courtroom, and interpreter fields are visible immediately without scrolling.
2. **Tab Switching**:
   Clicking between the three segmented tabs (`Courtroom & Profile`, `Documents & Signature`, `Cloud & Integrations`) switches views instantaneously with smooth opacity settling ($\le 150\text{ms}$) while keeping the modal height fixed and predictable.
3. **Cloud Service Management**:
   The **Cloud & Integrations** tab presents Google Calendar and Dropbox as compact status cards displaying connection health (`Connected`, `Checking...`, `Not Connected`). Clicking expands pairing tools, PKCE auto-renewal buttons, or folder path overrides cleanly.
4. **Saving & Applying**:
   The fixed modal footer contains the **Reset Defaults** link and the primary **Save & Apply to Case** action button, accessible at all times regardless of active tab.

### Visual Identity & Theme

- **Aesthetic Direction**: Professional judicial workstation; quiet utilitarian density following Brunei court styling standards; elimination of oversized promotional cards and generic AI placeholder text.
- **Color Palette & Tokens**:
  - Dominant Neutral: `bg-white dark:bg-slate-800` card surfaces with `border-slate-200 dark:border-slate-700`.
  - Active Tab & Primary Accents: Warm amber (`bg-amber-500 text-slate-950 font-bold`) matching the court branding.
  - Integration Status Accents: Google blue (`#2563EB`) and Dropbox sapphire (`#0284C7`), paired with status indicators in emerald (`#059669`) and rose (`#E11D48`).
- **Typography & Form Density**:
  - Micro-labels: `text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500`.
  - Input Fields: Compact height (`py-1.5 px-2.5 text-xs rounded-lg`) with 2-column responsive grid alignment.
  - Code & Paths: `font-mono text-[11px] tabular-nums`.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Tabbed Interface vs. Accordion List**
  - *Chosen Approach*: 3-tab segmented control at the top of the modal body.
  - *Why*: Eliminates vertical page shifting and layout jumping common with expanding accordions. Gives immediate 1-click access to any settings domain without scrolling.
  - *Alternatives Considered*: Single-page scroll with collapsible sections was rejected by the user in favor of tabbed navigation.
- **Decision 2: Status Cards for Google Calendar & Dropbox**
  - *Chosen Approach*: Compact card headers showing connection status badges and 1-click primary actions (Sign In / Disconnect / Reconnect), with advanced manual fields tucked inside quiet expandable drawers.
  - *Why*: Daily court use only requires knowing if the service is active; advanced credential entry is only needed during initial workstation pairing.
- **Decision 3: Preservation of DOM IDs and Hidden Inputs**
  - *Chosen Approach*: Retain exact IDs (`settingMagistrateName`, `settingCourtLocation`, `settingDropboxEnabledCheckbox`, `settingDropboxAppKeyInput`, etc.) and all auxiliary hidden inputs (`settingDropboxAccessToken`, `importProfileFileInput`).
  - *Why*: Guarantees 100% backward compatibility with existing storage keys, profile import/export routines, and background sync logic.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Magistrate Settings Modal Header                    │
│      [Sliders Icon] Magistrate Profile & Court Settings      [✕ Close] │
├────────────────────────────────────────────────────────────────────────┤
│ Segmented Tabs:                                                        │
│ [ 🏛️ Courtroom & Profile ] [ 📄 Documents & Signature ] [ ☁️ Cloud Sync ]│
├────────────────────────────────────────────────────────────────────────┤
│ TAB 1: COURTROOM & PROFILE                                            │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Active Profile Switcher: [Dropdown: Magistrate A ▼] [+ New] [🗑️]   │ │
│ │ Profile Portability: [Export Backup (.json)] [Import Backup]       │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ 2-Column Grid:                                                     │ │
│ │ • Magistrate Title & Full Name      • Preferred Courtroom / Venue  │ │
│ │ • Court District / Registry (BSB)   • Default Court Interpreter    │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ Focus Mode: [x] Autohide top navigation bar while typing           │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ TAB 2: DOCUMENTS & SIGNATURE                                           │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ File Naming Preset [Dropdown] & Custom Template Builder (Tokens)   │ │
│ │ Live Filename Preview: [.doc] / [.pdf]                             │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ Digital Signature: [Preview Box] [Upload Signature] [Remove]       │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ TAB 3: CLOUD & INTEGRATIONS                                            │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Google Calendar Card: [Status Badge] [1-Click Sign-In / Refresh]   │ │
│ │ • Target Calendar Select • Duration (15m/30m) • [Test Connection]  │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ Dropbox Card: [Toggle Sync] [Status: Connected/Not Connected]      │ │
│ │ • PKCE Auto-Renew Sign-in & App Key • Manual Token Drawer          │ │
│ │ • Dedicated Folder Paths (/Word, /PDF) & Local Backup Checkbox     │ │
│ └────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│ Modal Footer:                                                          │
│ [↺ Reset Defaults]  •  Saved to LocalStorage      [Cancel] [✓ Save]   │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State Mapping

- **Tab Switching State**:
  - `activeSettingsTab`: `'courtroom' | 'documents' | 'cloud'`.
  - Managed by a simple tab switcher function `switchSettingsTab(tabKey)` updating active button styling and toggling `hidden` on container panels.
- **Form Bindings (Existing)**:
  - `magistrateProfiles` dictionary in `localStorage`.
  - Active profile state mapped through existing `populateSettingsModalFromProfile(profile)`.
- **Cloud State Observers**:
  - Google Calendar status: `settingCalendarStatusBadge` & `settingVerifiedCalName`.
  - Dropbox status: `settingDropboxStatusBadge` & `dropboxConnectedView` vs `dropboxDisconnectedView`.

### Implementation Sequence

1. **Add Tab Navigation Header**: Insert a 3-button segmented tab bar below the modal header with icons and clean labels.
2. **Re-organize Modal Body into 3 Tab Containers**:
   - `settingsTabCourtroom`: Active Profile, Venue Defaults, Screen Visibility toggle.
   - `settingsTabDocuments`: File Naming convention presets, token builder, live filename preview, digital signature upload.
   - `settingsTabCloud`: Google Calendar summary card & settings, Dropbox Unified Sync toggle, PKCE card, folder paths.
3. **Streamline Copy & Anti-Slop Cleanup**:
   - Remove redundant descriptive paragraphs and marketing fluff.
   - Tighten form label spacing and replace sprawling boxes with clean borders.
4. **Wire Tab Switching Controller**:
   - Implement `switchSettingsTab(tabName)` with keyboard accessibility and active tab styling.
5. **Verify Compilation & Dev Server**:
   - Verify `compile_applet`, `lint_applet`, and test interactive tab switching.
