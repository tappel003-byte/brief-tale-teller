
# Report Builder — v1 (with Grok prompt)

A formatting tool that sits between the Distress Survey app and your final report. Import the field ZIP, paste/upload Grok's cleaned CSV, get back JPEG figures sized for an 11×17 landscape PowerPoint slide. Plus: the canonical Grok prompt you'll paste into Grok to get that CSV in the first place.

The app does **layout only**. Grok does cleanup + narrative. The two meet in the middle via a CSV.

---

## Pipeline

```
Distress Survey ZIP ─► Report Builder (import)
                              │
                              ├─► "Copy Grok prompt" button ──► paste into Grok
                              │                                       │
                              │                                       ▼
                              │                                  cleaned CSV
                              │                                       │
                              ◄───────── paste / upload ──────────────┘
                              │
                              ├─► Pin Schedule figure (JPEG, 11×17 landscape)
                              └─► Photo Plates figure  (JPEGs, 11×17 landscape, zipped)
```

---

## Screens

### 1. Home — Jobs list
- All saved jobs: name, date, pin count, photo count, status (needs Grok CSV / ready to export)
- "New Job" button
- Delete button per job (with confirm)

### 2. New job — Step 1: Import ZIP
- Drop ZIP → extract pins.csv, photos, plan
- Save as job
- Shows: "Found N pins, M photos"

### 3. New job — Step 2: Grok round-trip
Two panels side by side:
- **Left: "Copy Grok prompt"** — generates the prompt (see below) pre-filled with the raw pin data from the ZIP, one click to copy.
- **Right: "Paste cleaned CSV"** — textbox + file upload. Parses, validates, shows the table.

### 4. Job detail
- Header: name, counts, status, delete
- Two export cards: **Pin Schedule** and **Photo Plates**

### 5. Pin Schedule export
- Toggle Room/Area column
- 1 or 2 columns
- Width (inches)
- Wrap on/off
- Live preview → Download JPEG

### 6. Photo Plates export
- Grid (app suggests based on photo count)
- Live preview of page 1
- Caption = corrected description from Grok CSV
- Download → zip of one JPEG per page

---

## The Grok prompt (shipped in v1)

The "Copy Grok prompt" button copies this, with the raw pin rows already pasted in. Grok returns one CSV you paste back.

```
You are cleaning up dictated field notes from a structural distress survey
for inclusion in a professional engineering report.

INPUT
Below is a CSV exported from a field-survey app. Each row is one numbered
"pin" the engineer dropped on a floor plan, with a dictated description
and the photo numbers associated with it.

Columns: Pin, Room/Area, Raw Description, Photos

TASK
Return a single CSV with exactly these four columns, in this order:

  Pin, Room/Area, Description, Photos

Rules for the Description column:
- Fix obvious dictation/transcription errors (e.g. "stair step" → "stairstep
  crack", "horiztonal" → "horizontal", "the the" → "the").
- Convert spoken fractions to numerals ("one quarter inch" → "1/4 inch",
  "three eighths" → "3/8").
- Normalize common construction terms when meaning is unambiguous.
- Keep the engineer's voice. Do not add facts, causes, or severity judgments
  that are not in the input.
- Plain prose, at most 3 sentences. No bullets, no markdown.

Rules for Room/Area:
- Pass through as given; only fix obvious transcription errors.

Rules for Pin and Photos:
- Pass through unchanged.

OUTPUT
- One CSV. Header row, then one row per pin.
- Quote any field containing a comma.
- No commentary before or after the CSV.

RAW DATA
<<<the app pastes the rows here>>>
```

A second use of Grok (the narrative report) is out of scope for the app — that's you talking to Grok directly, using the cleaned CSV as input. We can add a second prompt later if useful.

---

## Storage

Jobs are saved per browser in **IndexedDB** (handles photo blobs, survives refresh, easy to delete). No login, no server. Each job can be deleted from the home page.

There's an existing draft-in-localStorage flow in this codebase; we'll replace it with proper multi-job IndexedDB storage during this build, and migrate any existing draft on first run.

---

## What's in the codebase already

The project already has: ZIP import (`src/lib/zip-import.ts`), a Zustand store (`src/lib/store.ts`), a workspace with outline/canvas/inspector, AI cleanup server function, and a `.report.json` save/load path. We'll **reuse** the import + AI plumbing and **add**:
- jobs list + IndexedDB persistence layer
- Grok prompt panel (copy button)
- Grok CSV paste/upload + parser + validator
- Pin Schedule export renderer (HTML → JPEG at 2550×1650)
- Photo Plates export renderer + zip download

The existing single-project workspace stays as the "open job" view, lightly adapted.

---

## Technical details (skip if not your thing)

- ZIP: `jszip` (already installed)
- CSV: `papaparse`
- IndexedDB: `idb`
- JPEG render: `html-to-image` against a hidden node sized to 2550×1650 (11×17 @ 150 DPI landscape)
- Zip on export: `jszip` again

---

## Build order

1. IndexedDB jobs layer + jobs list home page (replaces current home for multi-job)
2. Wire existing ZIP import into "new job" flow
3. Grok prompt panel (copy-to-clipboard with raw rows interpolated)
4. Grok CSV paste/upload + parse + validate + show table
5. Pin Schedule export (renderer + modal + download)
6. Photo Plates export (renderer + modal + zip download)
7. Polish: delete confirm, status badges, empty states

I'll pause after step 4 so you can do a full round-trip with the real ZIP + real Grok before I build the two export renderers.

---

## v2 Build List (pending — next session)

### Functional improvements
1. **Symbol placer / symbol layer** — Grok tags each pin with a symbol on import (ceiling_crack, spall, water_stain, etc.); report builder renders a symbol layer on top of the pin layer and auto-generates a legend box on the plan with only the symbols actually used.
2. **Undo/redo** — history stack so deleting a photo, capture, or pin isn't permanent.
3. **Interactive plan preview** — plan image shown in the Arrange stage with pin markers overlaid + a missing-pins checklist.

### UI overhaul
4. **Pipeline status strip** — Import → Grok → Review → Export progress indicator on the workspace.
5. **Job-card dashboard** — replace the plain jobs table with visual job cards.
6. **Audio clips on job detail** — inline audio player for voice notes.
7. **App name + visual identity** — logo, color palette, and type pairing.
