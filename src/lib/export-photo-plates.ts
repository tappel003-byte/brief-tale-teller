// Render photo plates as JPEG(s) with a flexible layout.
// Calibri by default; label, caption, gaps, and max wrap lines are all
// configurable from the UI so we don't have to be rigid about cell sizing.

export interface PhotoPlateItem {
  n: number;
  caption: string;
  src: string;
}

export interface PhotoPlateOptions {
  width?: number;
  height?: number;
  perPage?: number;
  cols?: number;
  quality?: number;
  /** Font family stack. Defaults to Calibri. */
  fontFamily?: string;
  /** Bold "Photo NN" label size in px. Default 22. */
  labelSize?: number;
  /** Caption size in px. Default 20. */
  captionSize?: number;
  /** Gap (px) between photo bottom and label. Default 10. */
  photoLabelGap?: number;
  /** Gap (px) between label and caption. Default 6. */
  labelCaptionGap?: number;
  /** Max wrapped caption lines per cell. Default 4. */
  maxCaptionLines?: number;
}

export interface PlateResult {
  blob: Blob;
  index: number;
  total: number;
}

const DEFAULT_W = 2800;
const DEFAULT_H = 1600;

export async function renderPhotoPlates(
  photos: PhotoPlateItem[],
  opts: PhotoPlateOptions = {},
): Promise<PlateResult[]> {
  if (!photos.length) return [];

  const W = opts.width ?? DEFAULT_W;
  const H = opts.height ?? DEFAULT_H;
  const perPage = opts.perPage ?? pickPerPage(photos.length);
  const cols = opts.cols ?? pickCols(perPage);
  const rows = Math.ceil(perPage / cols);

  const loaded = await Promise.all(photos.map(loadImg));

  const pages: PhotoPlateItem[][] = [];
  for (let i = 0; i < photos.length; i += perPage) {
    pages.push(photos.slice(i, i + perPage));
  }

  const pageOpts: PageOpts = {
    W,
    H,
    cols,
    rows,
    quality: opts.quality ?? 0.9,
    fontFamily: opts.fontFamily ?? `Calibri, "Carlito", Arial, sans-serif`,
    labelSize: opts.labelSize ?? 22,
    captionSize: opts.captionSize ?? 20,
    photoLabelGap: opts.photoLabelGap ?? 10,
    labelCaptionGap: opts.labelCaptionGap ?? 6,
    maxCaptionLines: opts.maxCaptionLines ?? 4,
  };

  const results: PlateResult[] = [];
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const blob = await renderPage(
      page,
      page.map((p) => loaded[photos.indexOf(p)]),
      pageOpts,
    );
    results.push({ blob, index: pageIdx, total: pages.length });
  }
  return results;
}

function pickPerPage(total: number): number {
  if (total <= 6) return Math.min(total, 6);
  if (total <= 10) return total;
  return 10;
}
function pickCols(perPage: number): number {
  if (perPage <= 3) return perPage;
  if (perPage <= 6) return 3;
  if (perPage <= 8) return 4;
  return 5;
}

interface PageOpts {
  W: number;
  H: number;
  cols: number;
  rows: number;
  quality: number;
  fontFamily: string;
  labelSize: number;
  captionSize: number;
  photoLabelGap: number;
  labelCaptionGap: number;
  maxCaptionLines: number;
}

async function renderPage(
  items: PhotoPlateItem[],
  imgs: HTMLImageElement[],
  o: PageOpts,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = o.W;
  canvas.height = o.H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, o.W, o.H);

  const padX = Math.round(o.W * 0.025);
  const padY = Math.round(o.H * 0.03);
  const gutterX = Math.round(o.W * 0.018);
  const gutterY = Math.round(o.H * 0.045);

  const cellW = (o.W - padX * 2 - gutterX * (o.cols - 1)) / o.cols;
  const cellH = (o.H - padY * 2 - gutterY * (o.rows - 1)) / o.rows;

  const labelSize = o.labelSize;
  const captionSize = o.captionSize;
  const captionLineH = Math.round(captionSize * 1.25);
  const textBlockH =
    labelSize + o.labelCaptionGap + captionLineH * o.maxCaptionLines;
  const photoH = Math.max(0, cellH - textBlockH - o.photoLabelGap);

  const labelFont = `bold ${labelSize}px ${o.fontFamily}`;
  const captionFont = `${captionSize}px ${o.fontFamily}`;

  for (let i = 0; i < items.length; i++) {
    const row = Math.floor(i / o.cols);
    const col = i % o.cols;
    const x = padX + col * (cellW + gutterX);
    const y = padY + row * (cellH + gutterY);
    const img = imgs[i];
    const item = items[i];

    if (img && img.naturalWidth) {
      const scale = Math.min(cellW / img.naturalWidth, photoH / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      ctx.drawImage(img, x, y, drawW, drawH);
    }

    // Text block: left-aligned with photo, constrained to cellW (no overlap into next column).
    const textTop = y + photoH + o.photoLabelGap;
    ctx.fillStyle = "#111111";
    ctx.textBaseline = "top";
    ctx.font = labelFont;
    ctx.fillText(`Photo ${pad2(item.n)}`, x, textTop);

    ctx.font = captionFont;
    ctx.fillStyle = "#222222";
    wrapText(
      ctx,
      item.caption || "",
      x,
      textTop + labelSize + o.labelCaptionGap,
      cellW,
      captionLineH,
      o.maxCaptionLines,
    );
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      o.quality,
    );
  });
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  maxLines: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxW) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);

  // Ellipsize last line if we ran out of room.
  const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (consumed < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (ctx.measureText(last + "…").width > maxW && last.length > 0) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = last + "…";
  }

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * lineH);
  }
}

function loadImg(p: PhotoPlateItem): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = p.src;
  });
}
