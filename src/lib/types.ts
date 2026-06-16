// Shared types for the report editor.

export type SectionKind =
  | "cover"
  | "freetext"
  | "findings"
  | "page-break";

export interface PhotoRef {
  /** Global photo number from the field app, e.g. 4 -> photo-04.jpg */
  n: number;
  /** Filename inside the ZIP (preserved verbatim). */
  filename: string;
  /** Optional per-photo caption override. Falls back to "Photo {n}". */
  caption?: string;
}

export interface Pin {
  id: string;
  /** e.g. "1", "2"… preserved from the CSV when present. */
  location: string;
  type: string;
  rawDescription: string;
  cleanedDescription: string;
  /** Whether the user has edited the cleaned text by hand. */
  userEdited: boolean;
  /** Room / area, populated by Grok cleanup pass. */
  roomArea?: string;
  /** "Photo Count" hint from the CSV (informational). */
  photoCount: number;
  photos: PhotoRef[];
  /** Optional per-finding heading override. */
  headingOverride?: string;
}

export interface CoverSection {
  id: string;
  kind: "cover";
  title: string;
  address: string;
  date: string;
  engineer: string;
  /** Optional plan image filename (rendered if present). */
  planFilename?: string;
}

export interface FreeTextSection {
  id: string;
  kind: "freetext";
  title: string;
  /** HTML or plain text. */
  body: string;
}

export interface FindingsSection {
  id: string;
  kind: "findings";
  title: string;
  /** Ordered pin ids inside this group. */
  pinIds: string[];
}

export interface PageBreakSection {
  id: string;
  kind: "page-break";
}

export type ReportSection =
  | CoverSection
  | FreeTextSection
  | FindingsSection
  | PageBreakSection;

export interface PhotoAsset {
  filename: string;
  /** base64 (no data: prefix) — survives serialization to .report.json. */
  base64: string;
  mime: string;
}

export interface ReportProject {
  /** Schema version; bump when shape changes. */
  v: 1;
  /** Stable job id (uuid). Used as the IndexedDB key. */
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  pins: Record<string, Pin>;
  sections: ReportSection[];
  /** filename -> asset bytes (photos + plan). */
  assets: Record<string, PhotoAsset>;
  /** True once a Grok-cleaned CSV has been imported. */
  grokImported?: boolean;
}
