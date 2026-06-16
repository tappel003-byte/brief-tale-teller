// Multi-job persistence backed by IndexedDB (via `idb`).
//
// Each "job" is a saved ReportProject (field ZIP + optional Grok-cleaned data).
// We store the full project (including embedded photo base64) in one record
// keyed by project.id. Photo blobs survive refresh.

import { openDB, type IDBPDatabase } from "idb";
import type { ReportProject } from "./types";

const DB_NAME = "report-builder";
const DB_VERSION = 1;
const STORE = "jobs";

export interface JobSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  pinCount: number;
  photoCount: number;
  grokImported: boolean;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveJob(project: ReportProject): Promise<void> {
  const db = await getDb();
  await db.put(STORE, project);
}

export async function loadJob(id: string): Promise<ReportProject | null> {
  const db = await getDb();
  const rec = (await db.get(STORE, id)) as ReportProject | undefined;
  return rec ?? null;
}

export async function deleteJob(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

export async function listJobs(): Promise<JobSummary[]> {
  const db = await getDb();
  const all = (await db.getAll(STORE)) as ReportProject[];
  return all
    .map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      pinCount: Object.keys(p.pins ?? {}).length,
      photoCount: Object.values(p.assets ?? {}).filter((a) =>
        a.mime.startsWith("image/"),
      ).length,
      grokImported: !!p.grokImported,
    }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}
