// Parse a Grok-cleaned CSV and merge it into a ReportProject.
//
// Expected columns (case-insensitive, order-insensitive):
//   Pin, Room/Area, Description, Photos

import Papa from "papaparse";
import type { Pin, ReportProject } from "./types";

export interface GrokRow {
  pin: string;
  roomArea: string;
  description: string;
  photos: string;
}

export interface ParseResult {
  rows: GrokRow[];
  warnings: string[];
  /** Pin labels in the project that the CSV did not mention. */
  missingPins: string[];
  /** CSV pins that don't match any pin in the project. */
  unknownPins: string[];
  /** Interview Notes block split off from the CSV, when present. */
  interviewNotes?: string;
}

const INTERVIEW_DIVIDER_RE = /^=+\s*INTERVIEW\s+NOTES\s*=+\s*$/im;

/**
 * Split Grok's combined reply ("PART 1 CSV\n===INTERVIEW NOTES===\nPART 2")
 * into the CSV portion and the interview-notes portion. Either may be empty.
 */
export function splitGrokReply(text: string): {
  csv: string;
  interviewNotes?: string;
} {
  const m = text.match(INTERVIEW_DIVIDER_RE);
  if (!m || m.index === undefined) return { csv: text };
  const csv = text.slice(0, m.index).trim();
  const rest = text.slice(m.index + m[0].length).trim();
  const notes =
    !rest || /^\(no audio interview provided\)\s*$/i.test(rest)
      ? undefined
      : rest;
  return { csv, interviewNotes: notes };
}

const COL_ALIASES: Record<keyof GrokRow, string[]> = {
  pin: ["pin", "pin #", "pin number", "location", "#"],
  roomArea: ["room/area", "room", "area", "location"],
  description: ["description", "cleaned description", "desc"],
  photos: ["photos", "photo numbers", "photo #s"],
};

export function parseGrokCsv(
  text: string,
  project: ReportProject,
): ParseResult {
  const warnings: string[] = [];
  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (parsed.errors.length) {
    for (const e of parsed.errors) warnings.push(`Row ${e.row}: ${e.message}`);
  }

  const headerMap = mapHeaders(parsed.meta.fields ?? []);
  if (!headerMap.pin || !headerMap.description) {
    throw new Error(
      "Couldn't find required columns. Expected: Pin, Room/Area, Description, Photos.",
    );
  }

  const rows: GrokRow[] = parsed.data
    .map((r) => ({
      pin: clean(r[headerMap.pin!]),
      roomArea: headerMap.roomArea ? clean(r[headerMap.roomArea]) : "",
      description: clean(r[headerMap.description!]),
      photos: headerMap.photos ? clean(r[headerMap.photos]) : "",
    }))
    .filter((r) => r.pin || r.description);

  const projectPins = new Set(
    Object.values(project.pins).map((p) => p.location.trim()),
  );
  const csvPins = new Set(rows.map((r) => r.pin.trim()));

  const missingPins = [...projectPins].filter((p) => !csvPins.has(p));
  const unknownPins = [...csvPins].filter((p) => !projectPins.has(p));

  return { rows, warnings, missingPins, unknownPins };
}

export function applyGrokRows(
  project: ReportProject,
  rows: GrokRow[],
): ReportProject {
  const byLocation = new Map<string, Pin>();
  for (const p of Object.values(project.pins))
    byLocation.set(p.location.trim(), p);

  const nextPins: Record<string, Pin> = { ...project.pins };
  for (const row of rows) {
    const pin = byLocation.get(row.pin.trim());
    if (!pin) continue;
    nextPins[pin.id] = {
      ...pin,
      cleanedDescription: row.description || pin.cleanedDescription,
      roomArea: row.roomArea || pin.roomArea,
      userEdited: false,
    };
  }

  return {
    ...project,
    pins: nextPins,
    grokImported: true,
    updatedAt: new Date().toISOString(),
  };
}

function clean(v: unknown): string {
  return (v ?? "").toString().trim();
}

function mapHeaders(fields: string[]): Partial<Record<keyof GrokRow, string>> {
  const out: Partial<Record<keyof GrokRow, string>> = {};
  const lower = fields.map((f) => ({ orig: f, low: f.toLowerCase().trim() }));
  for (const key of Object.keys(COL_ALIASES) as (keyof GrokRow)[]) {
    const aliases = COL_ALIASES[key];
    const hit = lower.find((f) => aliases.includes(f.low));
    if (hit) out[key] = hit.orig;
  }
  return out;
}
