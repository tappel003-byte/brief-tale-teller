// Select-and-copy the report canvas as rich HTML + plain-text fallback.
// Pasting into Word / Google Docs / Pages preserves tables, headings, and images.

export async function copyCanvasToClipboard(): Promise<boolean> {
  const node = document.getElementById("report-canvas-root");
  if (!node) return false;

  // Clone so we don't mutate the live DOM.
  const clone = node.cloneNode(true) as HTMLElement;

  // Strip editor-only chrome (toolbars, drag handles, contenteditable attrs).
  clone.querySelectorAll("[data-editor-only]").forEach((n) => n.remove());
  clone.querySelectorAll("[contenteditable]").forEach((n) => {
    (n as HTMLElement).removeAttribute("contenteditable");
    (n as HTMLElement).removeAttribute("data-placeholder");
  });

  // Inline the report stylesheet rules we care about so paste targets respect them.
  const html =
    `<html><head><meta charset="utf-8"><style>
      body { font-family: 'Source Serif 4', Georgia, serif; color:#171a23; }
      h1 { font-family: 'IBM Plex Sans', Arial, sans-serif; font-size:22pt; margin:0 0 .25rem; }
      h2 { font-family: 'IBM Plex Sans', Arial, sans-serif; font-size:14pt; border-bottom:1px solid #ccc; padding-bottom:4px; margin:1.5rem 0 .5rem;}
      h3 { font-family: 'IBM Plex Sans', Arial, sans-serif; font-size:11.5pt; margin:1rem 0 .25rem;}
      p { margin: 0 0 .6rem; line-height:1.5; }
      table.photo-table { width:100%; border-collapse: collapse; margin:.5rem 0;}
      table.photo-table td { border:1px solid #bbb; padding:6px; vertical-align:top; text-align:center; font-family:'IBM Plex Sans', Arial, sans-serif; font-size:9pt;}
      table.photo-table img { width:100%; height:auto; display:block; margin-bottom:4px;}
      .meta { font-family:'IBM Plex Sans', Arial, sans-serif; font-size:10pt; color:#555;}
    </style></head><body>${clone.innerHTML}</body></html>`;

  const text = clone.innerText;

  try {
    if (navigator.clipboard && "write" in navigator.clipboard) {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (e) {
    console.warn("Rich clipboard write failed, falling back", e);
  }

  // Fallback: plain text only.
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
