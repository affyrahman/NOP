# Fix Duplicate Footer in Word Desktop Export via Off-Page Header/Footer Table [COMPLETED]

Completely eliminate the duplicate footer on the last page of the Word (`.doc`) export when opened in the Microsoft Word desktop app by wrapping the footer definition in an off-page `#hrdftrtbl` table.

### User Review & Critical Decisions

> [!IMPORTANT]
> **Root Cause in Microsoft Word Desktop**:
> In Word-compatible HTML format, any HTML element placed in the document `<body>` (even outside `Section1`) is loaded into Word's document body stream. Because the element was physically visible in the HTML flow, Microsoft Word rendered it twice on the last page:
> 1. Once as a regular body element directly following the transcript notes (in the middle of the page).
> 2. Once as the running margin footer at the bottom of the page (from `@page Section1 { mso-footer: f1; }`).
>
> **Confirmed Solution (Industry Standard for Word HTML)**:
> Enclose the footer container in `<table id="hrdftrtbl">` with CSS `margin: 0in 0in 0in 900in; width: 1px; height: 1px; overflow: hidden;`. This pushes the body representation 900 inches off the printable canvas while allowing Microsoft Word's document parser to extract the `mso-element:footer` into Word's native margin footer engine.

- **Confirmed Application**: Microsoft Word desktop app.
- **Confirmed Handling**: Off-page table isolation (`table#hrdftrtbl`) preserving dynamic page numbering (`Page PAGE of NUMPAGES`) and clean case number (`MCCT/BSB/X/2026` or active case).

---

### 1. Overview & Core Concept

- **What It Does**:
  - Adds the standard `table#hrdftrtbl` CSS rule in the document `<head><style>`.
  - Wraps the footer `div#f1` in `<table id="hrdftrtbl" border="0" cellspacing="0" cellpadding="0"><tr><td>...</td></tr></table>`.
  - Ensures Word desktop registers `f1` purely as a page layout resource for the bottom margin, with zero residual content rendered in the document body.
- **Target Audience**: Court clerks, magistrates, and legal officers opening exported Notes of Proceedings in Microsoft Word desktop.
- **Key Value**: Clean, single running footer at the exact bottom margin of every page without visual clutter or duplication on the final page.

---

### 2. User Experience & Visual Layout

- **Document Body Flow**:
  - The Notes of Proceedings transcript ends naturally with the final proceedings paragraph, adjournment timestamp, or signature block.
  - No horizontal line, no case number text, and no page counter appear within the body flow of the last page.
- **Running Page Footer**:
  - Located cleanly in the 24pt bottom margin across all pages:
    - **Left**: Clean court case reference (e.g., `MCCT/BSB/14/2026` or fallback `MCCT/BSB/X/2026`).
    - **Right**: Word dynamic page numbering field (`Page 1 of 2`).
    - **Top Rule**: Subtle `0.5pt solid #cbd5e1` divider line.

---

### 3. Key Technical Decisions & Trade-Offs

- **Decision 1: Use `table#hrdftrtbl` with 900-inch offset**:
  - *Chosen Approach*: Wrap footer definition in `<table id="hrdftrtbl" style="margin:0in 0in 0in 900in; width:1px; height:1px; overflow:hidden;">`.
  - *Why*: Microsoft Word's HTML import parser specifically scans for `mso-element:header` and `mso-element:footer` inside `table#hrdftrtbl`. The extreme negative/positive offset ensures Word does not allocate space for the container in the body flow, completely removing the inline middle-of-page duplicate.
  - *Alternatives Considered*: Standard CSS `display: none`—discarded because Word's HTML filter completely strips `display: none` elements and fails to register the footer altogether.
- **Decision 2: Retain MSO XML block and `@page Section1`**:
  - *Chosen Approach*: Keep `<w:WordDocument><w:View>Print</w:View></w:WordDocument>` and `@page Section1 { mso-footer: f1; }`.
  - *Why*: Ensures Word opens directly in Print Layout mode with running margins active and page numbers functioning.

---

### 4. Technical Architecture & Document Structure

```
Word HTML Export Output:
┌────────────────────────────────────────────────────────────────────────┐
│ <html>                                                                 │
│   <head>                                                               │
│     <style>                                                            │
│       @page Section1 { mso-footer: f1; ... }                           │
│       table#hrdftrtbl { margin: 0 0 0 900in; width:1px; ... }          │
│     </style>                                                           │
│     <xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml> │
│   </head>                                                              │
│   <body>                                                               │
│     <div class="Section1">                                             │
│       <table> ... Court Header & Metadata ... </table>                 │
│       <div class="editor-body"> ... Notes Body ... </div>              │
│     </div>                                                             │
│                                                                        │
│     <!-- Hidden off-page table holding Word footer definition -->      │
│     <table id="hrdftrtbl" border="0" cellspacing="0" cellpadding="0">  │
│       <tr>                                                             │
│         <td>                                                           │
│           <div style="mso-element:footer" id="f1">                     │
│             <p class="MsoFooter">                                      │
│               <table> Case No | Page PAGE of NUMPAGES </table>         │
│             </p>                                                       │
│           </div>                                                       │
│         </td>                                                          │
│       </tr>                                                            │
│     </table>                                                           │
│   </body>                                                              │
│ </html>                                                                │
└────────────────────────────────────────────────────────────────────────┘
```

### 5. Implementation Steps

1. In `/index.html` within `generateWordHtmlDocument()`:
   - Add `table#hrdftrtbl { margin: 0in 0in 0in 900in; width: 1px; height: 1px; overflow: hidden; }` into the export CSS string.
   - Wrap the `<div style="mso-element:footer" id="f1">` block in `<table id="hrdftrtbl" border="0" cellspacing="0" cellpadding="0" style="margin:0in 0in 0in 900in; width:1px; height:1px; overflow:hidden;"><tr><td>...</td></tr></table>`.
2. Verify via `compile_applet` and test export output to confirm that only a single running footer appears at the bottom margin of the final page in Microsoft Word.
