---
name: Pin Schedule template
description: Locked visual spec for the Pin Schedule JPEG export — colors, columns, header, stripes, photo inlining
type: design
---
Pin Schedule export is LOCKED. Do not re-propose colors, table columns, or layout without the user asking.

- Each schedule panel has 2 table columns only: PIN | DESCRIPTION. No separate Photos column, no Room/Area column by default.
- The export must support either 1 vertical schedule panel or 2 side-by-side schedule panels so pin descriptions can fit a portrait/right-column placement.
- Photos go INLINE inside the description, e.g. "Diagonal crack right of entry door (Photos 7–8)".
- Header bar: solid `#141414`, white labels "PIN" and "DESCRIPTION".
- PIN numbers: bold black `#000000`, 2-digit (zero-padded).
- Row stripes: alternating `#eef0f3` and `#ffffff`.
- Body text color: `#1f2937`. Muted: `#5b6573`.
- Generous gutter (~0.30") between PIN column and DESCRIPTION column. Descriptions wrap freely.
- No title, no footer, no outer border chrome — just the table.
- White background JPEG, sized to natural width (no 11×17 forcing).
