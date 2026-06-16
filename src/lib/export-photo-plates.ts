// Render photo plates as JPEG(s) sized to drop into the empty area of the
// 11×17 landscape template (between "Picture/Damage Locations" and the
// Sandia Geo logo). Pure white background, photo grid, bold "Photo NN" +
// caption — matches the reference the user provided.

export interface PhotoPlateItem {
  n: number;
  caption: string;
  /** Already-resolved blob: or data: URL for the image. */
  src: string;
}

export interface PhotoPlateOptions {
  /** Output JPEG width in pixels. */
  width?: number;
  /** Output JPEG height in pixels. */
  height?: number;
  /** Photos per page. If omitted, picked from photo count + aspect. */
  perPage?: number;
  /** Override grid columns. */
  cols?: number;
  /** JPEG quality 0..1 */
  quality?: number;
}

export interface PlateResult {
  blob: Blob;
  index: number;
  total: number;
}

// The empty area on the 11×17 template between the title block and the
// Sandia Geo logo. ~14" wide × ~8" tall at the image's working ratio.
// We export at 200dpi-ish so it stays crisp when dropped into the slide.
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

  // Pre-load every image once.
  const loaded = await Promise.all(photos.map(loadImg));

  const pages: PhotoPlateItem[][] = [];
  for (let i = 0; i < photos.length; i += perPage) {
    pages.push(photos.slice(i, i + perPage));
  }

  const results: PlateResult[] = [];
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const blob = await renderPage(
      page,
      page.map((p) => loaded[photos.indexOf(p)]),
      { W, H, cols, rows, quality: opts.quality ?? 0.9 },
    );
    results.push({ blob, index: pageIdx, total: pages.length });
  }
  return results;
}

function pickPerPage(total: number): number {
  // Try to keep tiles big enough to read.  Capped at 10/page.
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

  // Reserve ~22% of the cell height for the label + caption block.
  const textBlockH = Math.round(cellH * 0.22);
  const photoH = cellH - textBlockH - 12;

  const labelSize = Math.round(cellH * 0.052);
  const captionSize = Math.round(cellH * 0.046);
  const labelFont = `bold ${labelSize}px Calibri, "Carlito", Arial, sans-serif`;
  const captionFont = `${captionSize}px Calibri, "Carlito", Arial, sans-serif`;

  for (let i = 0; i < items.length; i++) {
    const row = Math.floor(i / o.cols);
    const col = i % o.cols;
    const x = padX + col * (cellW + gutterX);
    const y = padY + row * (cellH + gutterY);
    const img = imgs[i];
    const item = items[i];

    // Photo, contained within (cellW × photoH), top-left anchored.
    if (img && img.naturalWidth) {
      const scale = Math.min(cellW / img.naturalWidth, photoH / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      // Left-align, top-align (matches the user's reference).
      const dx = x;
      const dy = y;
      ctx.drawImage(img, dx, dy, drawW, drawH);
    }

    // Text block: starts just below the reserved photo area.
    const textTop = y + photoH + 14;
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
      textTop + labelSize + 8,
      cellW,
      Math.round(captionSize * 1.25),
      2,
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
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxW) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  // If we ran out of room, ellipsize the last line.
  if (lines.length === maxLines) {
    const remaining = words.slice(
      lines.join(" ").split(/\s+/).length,
    );
    if (remaining.length) {
      let last = lines[maxLines - 1];
      while (
        ctx.measureText(last + "…").width > maxW &&
        last.length > 0
      ) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = last + "…";
    }
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
    img.onerror = () => resolve(img); // resolve empty; cell will just show text
    img.src = p.src;
  });
}
