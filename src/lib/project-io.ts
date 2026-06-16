// Save / Load .report.json (self-contained, photos embedded as base64).

import type { ReportProject } from "./types";

export function downloadReportJson(project: ReportProject) {
  const updated: ReportProject = {
    ...project,
    updatedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(updated, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(project.name) || "report"}.report.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function loadReportJson(
  file: File,
): Promise<{ project: ReportProject; objectUrls: Record<string, string> }> {
  const text = await file.text();
  const parsed = JSON.parse(text) as ReportProject;
  if (parsed?.v !== 1 || !parsed.assets || !parsed.pins || !parsed.sections) {
    throw new Error("Not a valid .report.json file.");
  }
  const objectUrls: Record<string, string> = {};
  for (const [filename, asset] of Object.entries(parsed.assets)) {
    const blob = base64ToBlob(asset.base64, asset.mime);
    objectUrls[filename] = URL.createObjectURL(blob);
  }
  return { project: parsed, objectUrls };
}

function base64ToBlob(b64: string, mime: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
