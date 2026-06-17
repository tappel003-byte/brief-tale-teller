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

// LOCKED canvas dimensions — every photo-plate JPEG comes out at this exact
// pixel size with the same outer white border so users can snap them to a
// fixed PowerPoint grid. Grid (rows × cols) varies with photos-per-plate.
const DEFAULT_W = 2800;
const DEFAULT_H = 1600;
const FIXED_PAD_X = 80; // px — constant outer white border, left/right
const FIXED_PAD_Y = 80; // px — constant outer white border, top/bottom

function gridFor(perPage: number): { cols: number; rows: number } {
  switch (perPage) {
    case 1: return { cols: 1, rows: 1 };
    case 2: return { cols: 2, rows: 1 };
    case 3: return { cols: 3, rows: 1 };
    case 4: return { cols: 2, rows: 2 };
    case 5: return { cols: 5, rows: 1 };
    case 6: return { cols: 3, rows: 2 };
    case 7:
    case 8: return { cols: 4, rows: 2 };
    case 9: return { cols: 3, rows: 3 };
    case 11:
    case 12: return { cols: 4, rows: 3 };
    case 10:
    default: return { cols: 5, rows: 2 };
  }
}

export async function renderPhotoPlates(
  photos: PhotoPlateItem[],
  opts: PhotoPlateOptions = {},
): Promise<PlateResult[]> {
  if (!photos.length) return [];

  const W = DEFAULT_W;
  const H = DEFAULT_H;
  const perPage = opts.perPage && opts.perPage > 0 ? opts.perPage : 10;
  const { cols, rows } = gridFor(perPage);

  const loaded = await Promise.all(photos.map(loadImg));

  const pages: PhotoPlateItem[][] = [];
  for (let i = 0; i < photos.length; i += perPage) {
    pages.push(photos.slice(i, i + perPage));
  }

  const baseOpts = {
    W,
    H,
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
    // Only re-grid when the ENTIRE set is smaller than perPage (e.g. user
    // picked 10/page but only has 4 photos total). For a short trailing page
    // of a larger set, keep the full grid so cells stay the same size.
    const useSmallGrid = photos.length < perPage;
    const pageGrid = useSmallGrid ? gridFor(photos.length) : { cols, rows };
    const pageOpts: PageOpts = { ...baseOpts, cols: pageGrid.cols, rows: pageGrid.rows };
    const blob = await renderPage(
      page,
      page.map((p) => loaded[photos.indexOf(p)]),
      pageOpts,
    );
    results.push({ blob, index: pageIdx, total: pages.length });
  }
  return results;
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

  // Fixed-pixel margins — never percent-based. This is the white outline that
  // must be identical on every exported plate so they snap to a PowerPoint grid.
  const padX = FIXED_PAD_X;
  const padY = FIXED_PAD_Y;
  const gutterX = 50;
  const gutterY = 70;

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
      // 1px warm-gray border so white photo backgrounds don't bleed into the page.
      ctx.strokeStyle = "#d4cfc8";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 0.5, y - 0.5, drawW + 1, drawH + 1);
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
