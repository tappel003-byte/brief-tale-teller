// Parse a Field Reporter ZIP export into a normalized ReportProject.

import JSZip from "jszip";
import Papa from "papaparse";
import type {
  Pin,
  PhotoAsset,
  PhotoRef,
  CaptureRef,
  ReportProject,
  ReportSection,
} from "./types";

interface RawPinRow {
  Location?: string;
  Type?: string;
  Description?: string;
  "Photo Count"?: string;
  "Photo Numbers"?: string;
}

interface ImportResult {
  project: ReportProject;
  objectUrls: Record<string, string>;
}

const PHOTO_RE = /^photo-(\d+)\.(jpe?g|png|webp)$/i;
const PLAN_RE = /^plan\.(png|jpe?g|pdf)$/i;
const IMG_EXT_RE = /\.(png|jpe?g|webp|pdf)$/i;
const CAPTURE_FOLDER_RE = /(^|\/)photo[\s_-]?captur[^/]*(\/|$)/i;

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

export async function importZipFile(file: File): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(file);

  // Locate pins.csv (case-insensitive, allow nested folder).
  const pinsEntry = Object.values(zip.files).find(
    (f) => !f.dir && /(^|\/)pins\.csv$/i.test(f.name),
  );
  if (!pinsEntry) {
    throw new Error(
      "Missing pins.csv — expected a Field Reporter export ZIP.",
    );
  }
  const pinsCsv = await pinsEntry.async("string");

  // Collect photos and plan.
  const assets: Record<string, PhotoAsset> = {};
  const objectUrls: Record<string, string> = {};
  let planFilename: string | undefined;
  let planFallback: string | undefined;

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const base = entry.name.split("/").pop() ?? entry.name;
    const planMatch = base.match(PLAN_RE);
    const photoMatch = base.match(PHOTO_RE);
    const extMatch = base.match(IMG_EXT_RE);
    // Treat any image whose name hints at a plan/map/site/key drawing as a candidate.
    const isPlanish =
      !photoMatch && !!extMatch && /plan|map|site|key|drawing/i.test(base);
    if (!planMatch && !photoMatch && !isPlanish) continue;

    const ext = (
      planMatch?.[1] ??
      photoMatch?.[2] ??
      extMatch?.[1] ??
      ""
    ).toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

    const blob = await entry.async("blob");
    const ab = await blob.arrayBuffer();
    const b64 = arrayBufferToBase64(ab);
    assets[base] = { filename: base, base64: b64, mime };
    objectUrls[base] = URL.createObjectURL(new Blob([ab], { type: mime }));

    if (planMatch && !planFilename) planFilename = base;
    else if (isPlanish && !planFallback) planFallback = base;
  }
  if (!planFilename) planFilename = planFallback;

  // Parse pins.
  const parsed = Papa.parse<RawPinRow>(pinsCsv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (parsed.errors.length) {
    console.warn("pins.csv parse warnings", parsed.errors);
  }

  const pins: Record<string, Pin> = {};
  const orderedPinIds: string[] = [];

  for (const row of parsed.data) {
    const location = (row.Location ?? "").toString().trim();
    if (!location && !(row.Description ?? "").trim()) continue;

    const nums = parsePhotoNumbers(row["Photo Numbers"] ?? "");
    const photos: PhotoRef[] = nums.map((n) => ({
      n,
      filename: findPhotoFilename(assets, n) ?? `photo-${pad(n)}.jpg`,
    }));

    const id = `pin-${orderedPinIds.length + 1}`;
    const desc = (row.Description ?? "").toString().trim();
    pins[id] = {
      id,
      location: location || String(orderedPinIds.length + 1),
      type: (row.Type ?? "").toString().trim(),
      rawDescription: desc,
      cleanedDescription: desc,
      userEdited: false,
      photoCount: Number(row["Photo Count"] ?? photos.length) || photos.length,
      photos,
    };
    orderedPinIds.push(id);
  }

  // Build default sections.
  const now = new Date();
  const sections: ReportSection[] = [
    {
      id: "sec-cover",
      kind: "cover",
      title: deriveTitleFromFilename(file.name),
      address: "",
      date: now.toISOString().slice(0, 10),
      engineer: "",
      planFilename,
    },
    {
      id: "sec-summary",
      kind: "freetext",
      title: "Summary",
      body:
        "Replace this with a short summary of the site visit, scope, and overall observations.",
    },
    {
      id: "sec-findings",
      kind: "findings",
      title: "Findings",
      pinIds: orderedPinIds,
    },
    {
      id: "sec-appendix",
      kind: "freetext",
      title: "Appendix",
      body: "Reference photos, plan key, and supporting documentation.",
    },
  ];

  const project: ReportProject = {
    v: 1,
    id: cryptoRandomId(),
    name: deriveTitleFromFilename(file.name),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    pins,
    sections,
    assets,
  };

  return { project, objectUrls };
}

function parsePhotoNumbers(raw: string): number[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function findPhotoFilename(
  assets: Record<string, PhotoAsset>,
  n: number,
): string | undefined {
  const candidates = [
    `photo-${pad(n)}.jpg`,
    `photo-${pad(n)}.jpeg`,
    `photo-${pad(n)}.png`,
    `photo-${pad(n)}.webp`,
    `photo-${n}.jpg`,
  ];
  for (const c of candidates) if (assets[c]) return c;
  // Fall back to any photo-{n} match.
  for (const f of Object.keys(assets)) {
    const m = f.match(PHOTO_RE);
    if (m && Number(m[1]) === n) return f;
  }
  return undefined;
}

function deriveTitleFromFilename(name: string): string {
  return name
    .replace(/\.(zip|report\.json)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Untitled Report";
}

function arrayBufferToBase64(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
