// Render the pin schedule as a single JPEG of a table — sized to its
// natural width/height. No page chrome, no forced 11×17.

import type { Pin } from "./types";

export interface PinScheduleOptions {
  includeRoomArea?: boolean;
  /** Pixel width of the rendered table. */
  width?: number;
  quality?: number;
}

export async function renderPinScheduleJpeg(
  pins: Pin[],
  opts: PinScheduleOptions = {},
): Promise<Blob> {
  const includeRoomArea = opts.includeRoomArea ?? true;
  const W = opts.width ?? 1800;
  const quality = opts.quality ?? 0.92;

  const columns: { key: "pin" | "room" | "desc" | "photos"; label: string; w: number }[] = includeRoomArea
    ? [
        { key: "pin", label: "Pin", w: 80 },
        { key: "room", label: "Room / Area", w: 320 },
        { key: "desc", label: "Description", w: W - 80 - 320 - 220 },
        { key: "photos", label: "Photos", w: 220 },
      ]
    : [
        { key: "pin", label: "Pin", w: 80 },
        { key: "desc", label: "Description", w: W - 80 - 220 },
        { key: "photos", label: "Photos", w: 220 },
      ];

  const sorted = [...pins].sort(
    (a, b) => parseLoc(a.location) - parseLoc(b.location),
  );

  const padX = 16;
  const padY = 14;
  const bodyFontSize = 20;
  const headerFontSize = 22;
  const lineH = bodyFontSize * 1.35;
  const bodyFont = `${bodyFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;
  const headerFont = `600 ${headerFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;

  // Measurement canvas.
  const meas = document.createElement("canvas").getContext("2d")!;

  function cellValue(p: Pin, key: typeof columns[number]["key"]): string {
    switch (key) {
      case "pin":
        return p.location || "";
      case "room":
        return p.roomArea || "";
      case "desc":
        return p.cleanedDescription || p.rawDescription || "";
      case "photos":
        return p.photos.map((ph) => ph.n).join(", ");
    }
  }

  // Pre-wrap every cell to compute row heights.
  meas.font = bodyFont;
  const rows = sorted.map((p) => {
    let maxLines = 1;
    const wrapped = columns.map((c) => {
      const text = cellValue(p, c.key);
      const lines = wrap(meas, text, c.w - padX * 2);
      if (lines.length > maxLines) maxLines = lines.length;
      return lines;
    });
    return { p, wrapped, height: Math.max(lineH * maxLines + padY * 2, 56) };
  });

  const headerH = headerFontSize * 1.3 + padY * 2;
  const totalH = headerH + rows.reduce((a, r) => a + r.height, 0);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.round(totalH);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, canvas.height);

  // Header background.
  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(0, 0, W, headerH);

  ctx.fillStyle = "#111111";
  ctx.textBaseline = "middle";
  ctx.font = headerFont;
  let x = 0;
  for (const c of columns) {
    ctx.fillText(c.label, x + padX, headerH / 2);
    x += c.w;
  }

  // Rows.
  let y = headerH;
  ctx.font = bodyFont;
  for (const r of rows) {
    let cx = 0;
    for (let i = 0; i < columns.length; i++) {
      const c = columns[i];
      const lines = r.wrapped[i];
      let ly = y + padY;
      ctx.fillStyle = "#111111";
      ctx.textBaseline = "top";
      for (const ln of lines) {
        ctx.fillText(ln, cx + padX, ly);
        ly += lineH;
      }
      cx += c.w;
    }
    y += r.height;
  }

  // Grid lines.
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  // Outer border.
  ctx.strokeRect(0.5, 0.5, W - 1, canvas.height - 1);
  // Vertical column dividers.
  let vx = 0;
  for (let i = 0; i < columns.length - 1; i++) {
    vx += columns[i].w;
    ctx.beginPath();
    ctx.moveTo(vx + 0.5, 0);
    ctx.lineTo(vx + 0.5, canvas.height);
    ctx.stroke();
  }
  // Horizontal: under header and between rows.
  let ry = headerH;
  ctx.beginPath();
  ctx.moveTo(0, ry + 0.5);
  ctx.lineTo(W, ry + 0.5);
  ctx.stroke();
  for (const r of rows) {
    ry += r.height;
    ctx.beginPath();
    ctx.moveTo(0, ry + 0.5);
    ctx.lineTo(W, ry + 0.5);
    ctx.stroke();
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      quality,
    );
  });
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
      // word longer than column? hard-break.
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
