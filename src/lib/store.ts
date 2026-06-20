// Zustand store for the editable report project.

import { create } from "zustand";
import type {
  Pin,
  ReportProject,
  ReportSection,
  PhotoRef,
  CoverSection,
  FindingsSection,
  FreeTextSection,
  CaptureRef,
} from "./types";
import { saveJob } from "./jobs-db";
import { applyGrokRows, type GrokRow } from "./grok-csv";

const LS_KEY = "report-builder.draft.v1";

interface State {
  project: ReportProject | null;
  selectedPinId: string | null;
  /** Object-URL cache: filename -> blob: URL. Built on import; cleared on close. */
  objectUrls: Record<string, string>;
  busy: boolean;
}

interface Actions {
  loadProject: (p: ReportProject, urls: Record<string, string>) => void;
  closeProject: () => void;
  selectPin: (id: string | null) => void;
  updatePin: (id: string, patch: Partial<Pin>) => void;
  setCleanedDescription: (id: string, text: string, userEdited: boolean) => void;
  revertCleaned: (id: string) => void;
  updateSection: (id: string, patch: Partial<ReportSection>) => void;
  moveSection: (id: string, dir: -1 | 1) => void;
  removeSection: (id: string) => void;
  addSection: (section: ReportSection, afterId?: string) => void;
  movePinInFindings: (sectionId: string, pinId: string, dir: -1 | 1) => void;
  reorderPhoto: (pinId: string, fromIdx: number, toIdx: number) => void;
  removePhotoFromPin: (pinId: string, photoIdx: number) => void;
  setObjectUrls: (urls: Record<string, string>) => void;
  hydrateFromDraft: () => boolean;
  applyGrok: (rows: GrokRow[], interviewNotes?: string) => void;
  loadJobById: (id: string) => Promise<boolean>;
  setCaptureLabel: (filename: string, label: string) => void;
  removeCapture: (filename: string) => void;
  attachCaptureToPin: (filename: string, pinId: string) => void;
  setPinPosition: (pinId: string, x: number | undefined, y: number | undefined) => void;
}

export const useReportStore = create<State & Actions>((set, get) => ({
  project: null,
  selectedPinId: null,
  objectUrls: {},
  busy: false,

  loadProject: (project, objectUrls) => {
    // Back-fill id for legacy projects (.report.json from older versions).
    const safe: ReportProject = project.id
      ? project
      : { ...project, id: randomId() };
    set({ project: safe, objectUrls, selectedPinId: null });
    persistDraft(safe);
  },

  closeProject: () => {
    const urls = get().objectUrls;
    Object.values(urls).forEach((u) => {
      try {
        URL.revokeObjectURL(u);
      } catch {
        /* noop */
      }
    });
    set({ project: null, objectUrls: {}, selectedPinId: null });
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* noop */
    }
  },

  selectPin: (id) => set({ selectedPinId: id }),

  updatePin: (id, patch) =>
    set((s) => {
      if (!s.project) return s;
      const pin = s.project.pins[id];
      if (!pin) return s;
      const next: ReportProject = {
        ...s.project,
        updatedAt: new Date().toISOString(),
        pins: { ...s.project.pins, [id]: { ...pin, ...patch } },
      };
      persistDraft(next);
      return { project: next };
    }),

  setCleanedDescription: (id, text, userEdited) =>
    get().updatePin(id, { cleanedDescription: text, userEdited }),

  revertCleaned: (id) =>
    set((s) => {
      if (!s.project) return s;
      const pin = s.project.pins[id];
      if (!pin) return s;
      const updated: Pin = {
        ...pin,
        cleanedDescription: pin.rawDescription,
        userEdited: false,
      };
      const next: ReportProject = {
        ...s.project,
        updatedAt: new Date().toISOString(),
        pins: { ...s.project.pins, [id]: updated },
      };
      persistDraft(next);
      return { project: next };
    }),

  updateSection: (id, patch) =>
    set((s) => {
      if (!s.project) return s;
      const next: ReportProject = {
        ...s.project,
        updatedAt: new Date().toISOString(),
        sections: s.project.sections.map((sec) =>
          sec.id === id ? ({ ...sec, ...patch } as ReportSection) : sec,
        ),
      };
      persistDraft(next);
      return { project: next };
    }),

  moveSection: (id, dir) =>
    set((s) => {
      if (!s.project) return s;
      const arr = [...s.project.sections];
      const idx = arr.findIndex((sec) => sec.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= arr.length) return s;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      const next: ReportProject = {
        ...s.project,
        updatedAt: new Date().toISOString(),
        sections: arr,
      };
      persistDraft(next);
      return { project: next };
    }),

  removeSection: (id) =>
    set((s) => {
      if (!s.project) return s;
      const next: ReportProject = {
        ...s.project,
        updatedAt: new Date().toISOString(),
        sections: s.project.sections.filter((sec) => sec.id !== id),
      };
      persistDraft(next);
      return { project: next };
    }),

  addSection: (section, afterId) =>
    set((s) => {
      if (!s.project) return s;
      const arr = [...s.project.sections];
      const idx = afterId ? arr.findIndex((sec) => sec.id === afterId) : -1;
      if (idx >= 0) arr.splice(idx + 1, 0, section);
      else arr.push(section);
      const next: ReportProject = {
        ...s.project,
        updatedAt: new Date().toISOString(),
        sections: arr,
      };
      persistDraft(next);
      return { project: next };
    }),

  movePinInFindings: (sectionId, pinId, dir) =>
    set((s) => {
      if (!s.project) return s;
      const sec = s.project.sections.find((x) => x.id === sectionId);
      if (!sec || sec.kind !== "findings") return s;
      const arr = [...sec.pinIds];
      const idx = arr.indexOf(pinId);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= arr.length) return s;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      const updated: FindingsSection = { ...sec, pinIds: arr };
      const next: ReportProject = {
        ...s.project,
        updatedAt: new Date().toISOString(),
        sections: s.project.sections.map((x) =>
          x.id === sectionId ? updated : x,
        ),
      };
      persistDraft(next);
      return { project: next };
    }),

  reorderPhoto: (pinId, fromIdx, toIdx) =>
    set((s) => {
      if (!s.project) return s;
      const pin = s.project.pins[pinId];
      if (!pin) return s;
      const photos = [...pin.photos];
      if (
        fromIdx < 0 ||
        toIdx < 0 ||
        fromIdx >= photos.length ||
        toIdx >= photos.length
      )
        return s;
      const [m] = photos.splice(fromIdx, 1);
      photos.splice(toIdx, 0, m);
      const next: ReportProject = {
        ...s.project,
        updatedAt: new Date().toISOString(),
        pins: { ...s.project.pins, [pinId]: { ...pin, photos } },
      };
      persistDraft(next);
      return { project: next };
    }),

  removePhotoFromPin: (pinId, photoIdx) =>
    set((s) => {
      if (!s.project) return s;
      const pin = s.project.pins[pinId];
      if (!pin) return s;
      const photos = pin.photos.filter((_, i) => i !== photoIdx);
      const next: ReportProject = {
        ...s.project,
        updatedAt: new Date().toISOString(),
        pins: { ...s.project.pins, [pinId]: { ...pin, photos } },
      };
      persistDraft(next);
      return { project: next };
    }),

  setObjectUrls: (urls) => set({ objectUrls: urls }),

  hydrateFromDraft: () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as ReportProject;
      if (parsed?.v !== 1 || !parsed.assets) return false;
      const urls: Record<string, string> = {};
      for (const [filename, asset] of Object.entries(parsed.assets)) {
        const blob = base64ToBlob(asset.base64, asset.mime);
        urls[filename] = URL.createObjectURL(blob);
      }
      set({ project: parsed, objectUrls: urls });
      return true;
    } catch (e) {
      console.warn("Failed to hydrate draft", e);
      return false;
    }
  },

  loadJobById: async (id: string) => {
    try {
      const { loadJob } = await import("./jobs-db");
      const proj = await loadJob(id);
      if (!proj) return false;
      // Revoke old URLs.
      const oldUrls = get().objectUrls;
      Object.values(oldUrls).forEach((u) => {
        try { URL.revokeObjectURL(u); } catch { /* noop */ }
      });
      const urls: Record<string, string> = {};
      for (const [filename, asset] of Object.entries(proj.assets)) {
        const blob = base64ToBlob(asset.base64, asset.mime);
        urls[filename] = URL.createObjectURL(blob);
      }
      set({ project: proj, objectUrls: urls, selectedPinId: null });
      return true;
    } catch (e) {
      console.warn("loadJobById failed", e);
      return false;
    }
  },

  applyGrok: (rows) =>
    set((s) => {
      if (!s.project) return s;
      const next = applyGrokRows(s.project, rows);
      persistDraft(next);
      return { project: next };
    }),

  setCaptureLabel: (filename, label) =>
    set((s) => {
      if (!s.project) return s;
      const captures = (s.project.captures ?? []).map((c) =>
        c.filename === filename ? { ...c, label } : c,
      );
      const next: ReportProject = {
        ...s.project,
        updatedAt: new Date().toISOString(),
        captures,
      };
      persistDraft(next);
      return { project: next };
    }),

  removeCapture: (filename) =>
    set((s) => {
      if (!s.project) return s;
      const captures = (s.project.captures ?? []).filter(
        (c) => c.filename !== filename,
      );
      // also drop any pin references to this filename
      const pins: Record<string, Pin> = {};
      for (const [id, p] of Object.entries(s.project.pins)) {
        pins[id] = { ...p, photos: p.photos.filter((ph) => ph.filename !== filename) };
      }
      const { [filename]: _drop, ...assets } = s.project.assets;
      const next: ReportProject = {
        ...s.project,
        updatedAt: new Date().toISOString(),
        captures,
        pins,
        assets,
      };
      persistDraft(next);
      return { project: next };
    }),

  attachCaptureToPin: (filename, pinId) =>
    set((s) => {
      if (!s.project) return s;
      const pin = s.project.pins[pinId];
      if (!pin) return s;
      // Skip if already attached.
      if (pin.photos.some((ph) => ph.filename === filename)) return s;
      // Synthetic n: max existing across all pins + 1, min 1.
      let maxN = 0;
      for (const p of Object.values(s.project.pins)) {
        for (const ph of p.photos) if (ph.n > maxN) maxN = ph.n;
      }
      const cap = (s.project.captures ?? []).find((c) => c.filename === filename);
      const photos: PhotoRef[] = [
        ...pin.photos,
        { n: maxN + 1, filename, caption: cap?.label },
      ];
      const next: ReportProject = {
        ...s.project,
        updatedAt: new Date().toISOString(),
        pins: { ...s.project.pins, [pinId]: { ...pin, photos } },
      };
      persistDraft(next);
      return { project: next };
    }),

  setPinPosition: (pinId, x, y) =>
    set((s) => {
      if (!s.project) return s;
      const pin = s.project.pins[pinId];
      if (!pin) return s;
      const cx = x === undefined ? undefined : Math.max(0, Math.min(1, x));
      const cy = y === undefined ? undefined : Math.max(0, Math.min(1, y));
      const next: ReportProject = {
        ...s.project,
        updatedAt: new Date().toISOString(),
        pins: { ...s.project.pins, [pinId]: { ...pin, x: cx, y: cy } },
      };
      persistDraft(next);
      return { project: next };
    }),
}));

// Touch import so unused type is fine when CaptureRef is only referenced via project shape.
export type { CaptureRef };

export type { CoverSection, FreeTextSection, FindingsSection, PhotoRef };

// --- helpers ---

function persistDraft(project: ReportProject) {
  if (typeof window === "undefined") return;
  try {
    // Best-effort autosave. Falls back silently if quota exceeded.
    localStorage.setItem(LS_KEY, JSON.stringify(project));
  } catch (e) {
    console.warn("Draft autosave failed (quota?)", e);
  }
  // Also write to IndexedDB so the job appears on the jobs list.
  // Debounced to avoid hammering on rapid edits.
  scheduleJobSave(project);
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: ReportProject | null = null;
function scheduleJobSave(project: ReportProject) {
  pendingSave = project;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const p = pendingSave;
    pendingSave = null;
    if (p) {
      saveJob(p).catch((e) => console.warn("IDB save failed", e));
    }
  }, 400);
}

function base64ToBlob(b64: string, mime: string): Blob {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
