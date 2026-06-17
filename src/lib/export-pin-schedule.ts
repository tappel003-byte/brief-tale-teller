// Render the pin schedule as a JPEG of the locked PIN | DESCRIPTION table.
//
// Each schedule panel is PIN | DESCRIPTION (with photos inlined as "(Photos N–M)").
// The schedule can render as one vertical panel or split into two side-by-side
// panels for fitting a tall portrait/right-column slide area.
// Cream alternating stripes, dark header, red circles for PINs.
// White background, natural width — no 11×17 forcing.

import type { Pin } from "./types";

export interface PinScheduleOptions {
  /** Pixel width of the rendered table. */
  width?: number;
  /** Number of side-by-side schedule panels. Each panel remains PIN | DESCRIPTION. */
  scheduleColumns?: 1 | 2 | 3 | 4;
  quality?: number;
}

// Locked palette — cream + red circles, less corporate.
const HEADER_BG = "#1a1a1a";
const HEADER_FG = "#ffffff";
const STRIPE = "#f5f0e8";
const BODY = "#1a1a1a";
const PIN_CIRCLE = "#c53030";
const PIN_FG = "#ffffff";

export async function renderPinScheduleJpeg(
  pins: Pin[],
  opts: PinScheduleOptions = {},
): Promise<Blob> {
  const W = opts.width ?? 1800;
  const scheduleColumns = (opts.scheduleColumns === 2 || opts.scheduleColumns === 3 || opts.scheduleColumns === 4) ? opts.scheduleColumns : 1;
  const quality = opts.quality ?? 0.92;

  // Layout (in px). Scaled down for denser multi-column layouts.
  const padX = scheduleColumns >= 3 ? 14 : 28;
  const panelGap = scheduleColumns === 2 ? 70 : scheduleColumns === 3 ? 40 : scheduleColumns === 4 ? 30 : 0;
  const panelW = Math.floor((W - panelGap * (scheduleColumns - 1)) / scheduleColumns);
  const gutter = scheduleColumns === 2 ? 44 : scheduleColumns >= 3 ? 24 : 54;
  const pinColW = scheduleColumns === 2 ? 96 : scheduleColumns === 3 ? 70 : scheduleColumns === 4 ? 60 : 130;
  const descOffset = padX + pinColW + gutter;
  const descW = panelW - descOffset - padX;

  const bodySize = 22;
  const pinSize = 28;
  const headerSize = 20;
  const lineH = Math.round(bodySize * 1.4);
  const rowPadY = 16;
  const headerH = 56;

  const bodyFont = `${bodySize}px Calibri, "Carlito", Arial, sans-serif`;
  const pinFont = `700 ${pinSize}px Calibri, "Carlito", Arial, sans-serif`;
  const headerFont = `700 ${headerSize}px Calibri, "Carlito", Arial, sans-serif`;

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

  const rowsPerPanel = Math.ceil(rows.length / scheduleColumns);
  const panels = Array.from({ length: scheduleColumns }, (_, i) =>
    rows.slice(i * rowsPerPanel, (i + 1) * rowsPerPanel),
  );
  const totalH =
    headerH +
    Math.max(0, ...panels.map((panel) => panel.reduce((a, r) => a + r.height, 0)));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.round(totalH);
  const ctx = canvas.getContext("2d")!;

  // White background.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, canvas.height);

  for (let panelIndex = 0; panelIndex < panels.length; panelIndex++) {
    const panelRows = panels[panelIndex];
    const panelX = panelIndex * (panelW + panelGap);
    const descX = panelX + descOffset;

    // Header.
    ctx.fillStyle = HEADER_BG;
    ctx.fillRect(panelX, 0, panelW, headerH);
    ctx.fillStyle = HEADER_FG;
    ctx.textBaseline = "middle";
    ctx.font = headerFont;
    ctx.fillText("PIN", panelX + padX, headerH / 2);
    ctx.fillText("DESCRIPTION", descX, headerH / 2);

    // Rows.
    let y = headerH;
    for (let i = 0; i < panelRows.length; i++) {
      const r = panelRows[i];
      // Stripe (every other row).
      if (i % 2 === 0) {
        ctx.fillStyle = STRIPE;
        ctx.fillRect(panelX, y, panelW, r.height);
      }

      // PIN (white on red circle, 2-digit).
      const pinText = pad2(r.p.location);
      ctx.font = pinFont;
      const pinTextW = ctx.measureText(pinText).width;
      const circleR = Math.max(pinTextW / 2 + 14, 22);
      const pinCx = panelX + padX + circleR;
      const pinCy = y + r.height / 2;
      ctx.beginPath();
      ctx.arc(pinCx, pinCy, circleR, 0, Math.PI * 2);
      ctx.fillStyle = PIN_CIRCLE;
      ctx.fill();
      ctx.fillStyle = PIN_FG;
      ctx.textBaseline = "middle";
      ctx.fillText(pinText, pinCx - pinTextW / 2, pinCy);

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
