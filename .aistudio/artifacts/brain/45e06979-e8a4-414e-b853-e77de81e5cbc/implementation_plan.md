# Smart Session Timing Automation & Toolbar Precision

A comprehensive plan to automate court hearing session timings—automatically capturing start times when typing proceedings and stamping end times upon exporting, printing, or adjourning—while providing clean, high-precision timestamp controls and streamlined toolbar styling.

### User Review & Critical Decisions

> [!IMPORTANT]
> Based on your clarifications, we are keeping the interface clean and focused strictly on start and end timestamps rather than adding elapsed duration timers. Automated start and stop triggers will handle the recording in the background so you never have to worry about forgetting to click buttons.

- **Confirmed Decision (Auto-Start Trigger)**: The session automatically begins and stamps the **In (Start)** time the moment you begin typing notes in the proceedings editor (if not already started).
- **Confirmed Decision (Auto-Stop Trigger)**: The session automatically ends and stamps the **Out (End)** time whenever you export the case to Word (`.docx`), download the PDF, print, or open the Court Adjournment dialog.
- **Confirmed Decision (Visual Tracking)**: No distracting duration/countdown timer. Clean, distinct start (`In`) and end (`Out`) timestamp indicators with clear active status, manual override support, and one-click "Now" clock adjustment buttons.

---

### 1. Overview & Core Concept

- **What It Does**: Automates court session tracking for judicial officers and court reporters. Automatically detects when hearing note-taking commences to record the exact start time, and automatically records the conclusion timestamp when proceedings are finalized, printed, exported, or adjourned.
- **Target Audience / Persona**: Judicial officers, magistrates, registrars, and court recorders in Brunei Darussalam courts who take dense notes and cannot afford to divert attention during fast-moving court hearings to click manual stopwatch buttons.
- **Key Value**: Zero cognitive overhead for session bookkeeping. Guarantees that official court records, export documents, and case metadata always carry authentic, accurate start and finish timings.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Starting a Hearing**:
   - The user opens a case or creates a new case.
   - When the user types the first word or speaker tag in the Notes of Proceedings (NOP) editor, the system detects typing activity:
     - Sets `startTime` to the current local time (e.g., `09:24 AM`).
     - Marks session as active (`isSessionActive = true`), switches the toggle button state, and displays a discreet, reassuring toast notification: *"Court Session Auto-Started at 09:24 AM"*.
2. **During the Hearing**:
   - The session block in the toolbar reflects an active session with an emerald border glow, bold emerald `In` time, and an empty/ready `Out` field.
   - If the judicial officer started early or slightly late, they can click the time directly or use a one-click quick clock icon to synchronize.
3. **Concluding / Adjourning / Exporting the Hearing**:
   - When the user clicks **Adjournment**, **Export Word (.docx)**, or **Export PDF / Print**, the system automatically stamps the current time into `endTime` (e.g., `10:15 AM`), marks the session as finished, and syncs the metadata into the case document header.
4. **Manual Control**:
   - The primary Start/Stop toggle button remains fully operational for manual overrides at any time, supplemented by hotkey `Alt + Shift + S`.

#### Visual Identity & Theme
- **Selected Element Target (`div#toolbar > div:nth-of-type(1)`)**:
  - Refined single-elevation container with subtle rounded border (`rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90`).
  - **In (Start)** Badge: Clean monospace typography with tabular figures (`tabular-nums font-mono text-emerald-600 dark:text-emerald-400`), subtle label `In`, and focus-ring accessibility.
  - **Out (End)** Badge: Polished monospace input with subtle rose styling (`text-rose-600 dark:text-rose-400 font-mono`) and soft placeholder (`--:--`).
  - **Active State Indicator**: Subtle emerald hairline outline or quiet badge when active, transitioning smoothly to neutral slate once concluded.
  - **Quick Action Affordances**: Tiny clock icons next to inputs allowing instant "Set to Now" with a single click without typing.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Keystroke-Driven Auto-Start**:
  - *Approach*: Hook into the editor's primary input listener (`editor.addEventListener('input')`). If `startTime` is empty or if session is inactive, initialize the session timestamp.
  - *Why*: Eliminates the most common failure point where hearings begin suddenly and recording is forgotten.
  - *Alternative Considered*: Auto-starting on case load. Rejected because cases may be loaded for review, browsing, or editing past cases where setting an immediate new start time would corrupt existing records.
- **Decision 2: Multi-Hook Auto-Stop**:
  - *Approach*: Hook into `exportWord()`, `exportPDF()`, and `openAdjournmentModal()`.
  - *Why*: Every court hearing culminates in either an adjournment order, a printed transcript, or a downloaded document. Catching all three guarantees 100% capture of the finish time.
  - *Alternative Considered*: Inactivity timeout. Rejected because court hearings often involve 10-15 minute pauses for in-chambers discussions or document examination where an auto-stop would prematurely end the session.
- **Decision 3: No Running Stopwatch / Duration Counter**:
  - *Approach*: Explicitly respect user confirmation to exclude elapsed timers. Focus strictly on clean start and end timestamps.
  - *Why*: Avoids visual anxiety and screen clutter in the compact single-line toolbar.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌────────────────────────────────────────────────────────────────────────┐
│                        JUDICIAL NOP WORKSPACE                          │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌───────────────────────────────┐           ┌────────────────────────────────┐
│   PROCEEDINGS EDITOR (NOP)    │           │    SESSION TIMING CONTROLLER   │
│   id="editor" [contenteditable│           │    isSessionActive, startTime, │
│                               │           │    endTime, metadata sync      │
└──────────────┬────────────────┘           └────────────────┬───────────────┘
               │ (1) User types first keystroke              │
               └───────────────────────► autoStartSession()  │
                                                             │
         ┌───────────────────────────────────────────────────┘
         │ (2) Hearing Concludes via:
         │     • openAdjournmentModal()
         │     • exportWord()
         │     • exportPDF() / print
         ▼
┌───────────────────────────────┐
│       autoStopSession()       │
│  - Stamps current time to Out │
│  - isSessionActive = false    │
│  - Updates docStartTime/End   │
│  - Syncs LocalStorage draft   │
└───────────────────────────────┘
```

#### State & Function Mapping
- `autoStartSessionIfInactive()`: Checks if `startTime` is blank or `!isSessionActive`. If so, stamps current time `HH:MM AM/PM`, sets `isSessionActive = true`, updates UI, calls `syncMetadata()`, and saves state.
- `autoStopSessionIfActive(reason)`: Checks if `isSessionActive` is true or if `endTime` is blank during export/adjournment. Stamps `endTime` with current time, marks `isSessionActive = false`, updates button state to "Start", and syncs case metadata.
- `setSessionTimeToNow(fieldId)`: Helper for the quick clock icons to instantly stamp `startTime` or `endTime` to the present time.
- Toolbar Styling: Refines `div#toolbar > div:nth-of-type(1)` markup with clean borders, zero-pill typography, and clear visual hierarchy.

---

### 5. Verification Plan
- **Verification 1 (Auto-Start)**: Clear the start time or start a new case; type any character into the NOP editor; confirm `startTime` is instantly populated, the button changes to `Stop`, and a brief toast notification confirms start.
- **Verification 2 (Auto-Stop on Adjournment)**: While a session is active, click the Adjournment button; verify `endTime` is immediately stamped with the current time and the session transitions to completed.
- **Verification 3 (Auto-Stop on Export)**: With an active session, trigger Export Word or Export PDF; verify `endTime` is automatically populated before the document generation completes.
- **Verification 4 (Manual Precision)**: Test manual toggle button and one-click clock presets to verify quick adjustment flexibility.
- **Verification 5 (Build & Lint)**: Run `compile_applet` and `lint_applet` to ensure syntax, DOM listeners, and exports compile cleanly.
