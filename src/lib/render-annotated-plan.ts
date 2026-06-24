// Render the clean plan image with numbered pin circles burned in.
// Used at export time so the field-app's burned-in map can be replaced
// with one that reflects the user's nudges.

import type { Pin, PhotoAsset } from "./types";

const PIN_RED = "#c53030";
const PIN_GREY = "#718096";

function pinColorFor(pin: Pin): string {
  if (pin.colorOverride === "grey") return PIN_GREY;
  if (pin.colorOverride === "red") return PIN_RED;
  const t = (pin.type || "").trim().toLowerCase();
  if (t.includes("exterior")) return PIN_GREY;
  return PIN_RED;
}

export async function renderAnnotatedPlanBlob(
  planAsset: PhotoAsset,
  pins: Pin[],
  opts: { format?: "image/png" | "image/jpeg"; quality?: number } = {},
): Promise<{ blob: Blob; ext: "png" | "jpg" }> {
  const placed = pins.filter(
    (p): p is Pin & { x: number; y: number } =>
      typeof p.x === "number" && typeof p.y === "number",
  );

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

  const R = Math.max(9, Math.min(W, H) * 0.011);
  ctx.font = `700 ${Math.round(R * 1.05)}px -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of placed) {
    const cx = p.x * W;
    const cy = p.y * H;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = pinColorFor(p);
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
