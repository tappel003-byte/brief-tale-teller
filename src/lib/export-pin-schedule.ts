// Render the pin schedule as a single JPEG of a 2-column table —
// LOCKED template, see mem://design/pin-schedule-template.
//
// PIN | DESCRIPTION (with photos inlined as "(Photos N–M)")
// Dark header bar, black bold 2-digit PINs, alternating grey/white stripes.
// White background, natural width — no 11×17 forcing.

import type { Pin } from "./types";

export interface PinScheduleOptions {
  /** Pixel width of the rendered table. */
  width?: number;
  quality?: number;
}

// Locked palette.
const HEADER_BG = "#141414";
const HEADER_FG = "#ffffff";
const STRIPE = "#eef0f3";
const BODY = "#1f2937";
const PIN_COLOR = "#000000";

export async function renderPinScheduleJpeg(
  pins: Pin[],
  opts: PinScheduleOptions = {},
): Promise<Blob> {
  const W = opts.width ?? 1800;
  const quality = opts.quality ?? 0.92;

  // Layout (in px). Generous gutter between PIN and DESCRIPTION.
  const padX = 28;
  const gutter = 54; // ~0.30" at 200dpi-ish
  const pinColW = 130;
  const descX = padX + pinColW + gutter;
  const descW = W - descX - padX;

  const bodySize = 22;
  const pinSize = 28;
  const headerSize = 20;
  const lineH = Math.round(bodySize * 1.4);
  const rowPadY = 16;
  const headerH = 56;

  const bodyFont = `${bodySize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;
  const pinFont = `700 ${pinSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;
  const headerFont = `700 ${headerSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;

  const sorted = [...pins].sort(
    (a, b) => parseLoc(a.location) - parseLoc(b.location),
  );

  // Measurement context.
  const meas = document.createElement("canvas").getContext("2d")!;
  meas.font = bodyFont;

  const rows = sorted.map((p) => {
    const desc = buildDescription(p);
    const lines = wrap(meas, desc, descW);
    const height = Math.max(lines.length * lineH + rowPadY * 2, 60);
    return { p, lines, height };
  });

  const totalH = headerH + rows.reduce((a, r) => a + r.height, 0);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.round(totalH);
  const ctx = canvas.getContext("2d")!;

  // White background.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, canvas.height);

  // Header.
  ctx.fillStyle = HEADER_BG;
  ctx.fillRect(0, 0, W, headerH);
  ctx.fillStyle = HEADER_FG;
  ctx.textBaseline = "middle";
  ctx.font = headerFont;
  ctx.fillText("PIN", padX, headerH / 2);
  ctx.fillText("DESCRIPTION", descX, headerH / 2);

  // Rows.
  let y = headerH;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    // Stripe (every other row).
    if (i % 2 === 0) {
      ctx.fillStyle = STRIPE;
      ctx.fillRect(0, y, W, r.height);
    }

    // PIN (black bold, 2-digit).
    ctx.fillStyle = PIN_COLOR;
    ctx.font = pinFont;
    ctx.textBaseline = "top";
    ctx.fillText(pad2(r.p.location), padX, y + rowPadY);

    // Description (wrapped, vertically padded).
    ctx.fillStyle = BODY;
    ctx.font = bodyFont;
    let ly = y + rowPadY;
    for (const ln of r.lines) {
      ctx.fillText(ln, descX, ly);
      ly += lineH;
    }

    y += r.height;
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      quality,
    );
  });
}

function buildDescription(p: Pin): string {
  const text = (p.cleanedDescription || p.rawDescription || "").trim();
  const photoStr = inlinePhotos(p.photos.map((x) => x.n));
  if (!photoStr) return text;
  // Don't double-append if Grok already put "(Photos …)" in there.
  if (/\(photos?\s/i.test(text)) return text;
  return text ? `${text} (${photoStr})` : `(${photoStr})`;
}

function inlinePhotos(nums: number[]): string {
  if (!nums.length) return "";
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  // Compress consecutive runs: 7,8,9 -> "Photos 7–9"; 7,8 -> "Photos 7–8"
  const runs: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    runs.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = cur;
    prev = cur;
  }
  const label = sorted.length === 1 ? "Photo" : "Photos";
  return `${label} ${runs.join(", ")}`;
}

function pad2(s: string): string {
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return s;
  return n < 10 ? `0${n}` : String(n);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxW) {
      line = test;
    } else {
      if (line) lines.push(line);
      if (ctx.measureText(w).width > maxW) {
        let chunk = "";
        for (const ch of w) {
          if (ctx.measureText(chunk + ch).width > maxW) {
            lines.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      } else {
        line = w;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

function parseLoc(s: string): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 9999;
}
