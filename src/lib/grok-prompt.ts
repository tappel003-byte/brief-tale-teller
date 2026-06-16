// Builds the canonical Grok cleanup prompt for a given project.
// The user clicks "Copy Grok prompt", pastes into Grok, gets a CSV back.

import Papa from "papaparse";
import type { ReportProject } from "./types";

export const GROK_INSTRUCTIONS = `You are cleaning up dictated field notes from a structural distress survey for inclusion in a professional engineering report.

INPUT
Below is a CSV exported from a field-survey app. Each row is one numbered "pin" the engineer dropped on a floor plan, with a dictated description and the photo numbers associated with it.

Columns: Pin, Room/Area, Raw Description, Photos

TASK
Return a single CSV with exactly these four columns, in this order:

  Pin, Room/Area, Description, Photos

Rules for the Description column:
- Fix obvious dictation/transcription errors (e.g. "stair step" -> "stairstep crack", "horiztonal" -> "horizontal", "the the" -> "the").
- Convert spoken fractions to numerals ("one quarter inch" -> "1/4 inch", "three eighths" -> "3/8").
- Normalize common construction terms when meaning is unambiguous.
- Keep the engineer's voice. Do not add facts, causes, or severity judgments that are not in the input.
- Plain prose, at most 3 sentences. No bullets, no markdown.

Rules for Room/Area:
- Pass through as given; only fix obvious transcription errors. If the input is blank, infer from the Type/Description only when obvious; otherwise leave blank.

Rules for Pin and Photos:
- Pass through unchanged.

OUTPUT
- One CSV. Header row, then one row per pin.
- Quote any field containing a comma.
- No commentary before or after the CSV.

RAW DATA
`;

export function buildGrokPrompt(project: ReportProject): string {
  // Iterate pins in section order (the "findings" section holds the canonical
  // order); fall back to insertion order of the pins map.
  const pinIds = collectPinOrder(project);

  const rows = pinIds.map((id) => {
    const p = project.pins[id];
    const photos = p.photos.map((ph) => ph.n).join(", ");
    // "Room/Area" — best guess is the pin's existing location/type since the
    // field app does not currently capture a structured room. We pass both.
    const roomArea = p.roomArea ?? p.type ?? "";
    return {
      Pin: p.location,
      "Room/Area": roomArea,
      "Raw Description": p.rawDescription,
      Photos: photos,
    };
  });

  const csv = Papa.unparse(rows, { quotes: true, newline: "\n" });
  return GROK_INSTRUCTIONS + csv;
}

function collectPinOrder(project: ReportProject): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const s of project.sections) {
    if (s.kind === "findings") {
      for (const id of s.pinIds) {
        if (project.pins[id] && !seen.has(id)) {
          seen.add(id);
          ordered.push(id);
        }
      }
    }
  }
  for (const id of Object.keys(project.pins)) {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  return ordered;
}
