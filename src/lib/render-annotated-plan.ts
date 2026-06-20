// Render the clean plan image with numbered pin circles burned in.
// Used at export time so the field-app's burned-in map can be replaced
// with one that reflects the user's nudges.

import type { Pin, PhotoAsset } from "./types";

interface PlacedPin {
  location: string;
  x: number; // 0–1
  y: number; // 0–1
}

export async function renderAnnotatedPlanBlob(
  planAsset: PhotoAsset,
  pins: Pin[],
  opts: { format?: "image/png" | "image/jpeg"; quality?: number } = {},
): Promise<{ blob: Blob; ext: "png" | "jpg" }> {
  const placed: PlacedPin[] = pins
    .filter((p): p is Pin & { x: number; y: number } =>
      typeof p.x === "number" && typeof p.y === "number",
    )
    .map((p) => ({ location: p.location, x: p.x, y: p.y }));

  const dataUrl = `data:${planAsset.mime};base64,${planAsset.base64}`;
  const img = await loadImage(dataUrl);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.drawImage(img, 0, 0, W, H);

  const R = Math.max(14, Math.min(W, H) * 0.018);
  ctx.font = `700 ${Math.round(R * 1.05)}px -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of placed) {
    const cx = p.x * W;
    const cy = p.y * H;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = "#c14a2b";
    ctx.fill();
    ctx.lineWidth = R * 0.18;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.fillText(p.location, cx, cy + R * 0.04);
  }

  const format = opts.format ?? "image/png";
  const quality = opts.quality ?? 0.92;
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      format,
      quality,
    ),
  );
  return { blob, ext: format === "image/jpeg" ? "jpg" : "png" };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
