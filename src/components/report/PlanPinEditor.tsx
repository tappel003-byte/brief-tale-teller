// Interactive plan editor: shows the chosen plan image with draggable
// numbered pin circles. Pins without (x,y) appear in a tray; click a
// tray pin, then click on the plan to place it.

import { useCallback, useMemo, useRef, useState } from "react";
import { useReportStore } from "@/lib/store";
import type { Pin } from "@/lib/types";

interface Props {
  planUrl: string;
  pins: Pin[];
}

export function PlanPinEditor({ planUrl, pins }: Props) {
  const setPinPosition = useReportStore((s) => s.setPinPosition);
  const [dragging, setDragging] = useState<string | null>(null);
  const [placingId, setPlacingId] = useState<string | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const placed = useMemo(
    () =>
      pins.filter(
        (p): p is Pin & { x: number; y: number } =>
          typeof p.x === "number" && typeof p.y === "number",
      ),
    [pins],
  );
  const unplaced = useMemo(
    () => pins.filter((p) => typeof p.x !== "number" || typeof p.y !== "number"),
    [pins],
  );

  const sortedPlaced = useMemo(
    () =>
      [...placed].sort(
        (a, b) => (parseInt(a.location) || 9999) - (parseInt(b.location) || 9999),
      ),
    [placed],
  );

  const pointToFraction = useCallback((clientX: number, clientY: number) => {
    const el = wrapRef.current?.querySelector("img");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  }, []);

  function onPinPointerDown(e: React.PointerEvent, pinId: string) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragging(pinId);
  }

  function onSvgPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const f = pointToFraction(e.clientX, e.clientY);
    if (!f) return;
    setPinPosition(dragging, f.x, f.y);
  }

  function onSvgPointerUp(e: React.PointerEvent) {
    if (dragging) {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      setDragging(null);
    }
  }

  function onImageClick(e: React.MouseEvent) {
    if (!placingId) return;
    const f = pointToFraction(e.clientX, e.clientY);
    if (!f) return;
    setPinPosition(placingId, f.x, f.y);
    setPlacingId(null);
  }

  const aspect = imgDims ? imgDims.w / imgDims.h : 4 / 3;

  return (
    <div className="space-y-3">
      <div
        ref={wrapRef}
        className="relative rounded-md border bg-canvas overflow-hidden shadow-[var(--shadow-canvas)]"
        style={{ aspectRatio: String(aspect) }}
      >
        <img
          src={planUrl}
          alt="Floor plan"
          className={`absolute inset-0 w-full h-full object-contain select-none ${placingId ? "cursor-crosshair" : ""}`}
          draggable={false}
          onLoad={(e) => {
            const t = e.currentTarget;
            setImgDims({ w: t.naturalWidth, h: t.naturalHeight });
          }}
          onClick={onImageClick}
        />
        {/* Overlay SVG positioned to match object-contain box */}
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full pointer-events-none"
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
        >
          {sortedPlaced.map((p) => {
            const cx = p.x * 1000;
            const cy = p.y * 1000;
            const r = 10;
            const isDragging = dragging === p.id;
            const fill =
              p.colorOverride === "grey"
                ? "#718096"
                : p.colorOverride === "red"
                  ? "#c53030"
                  : (p.type || "").toLowerCase().includes("exterior")
                    ? "#718096"
                    : "#c53030";
            return (
              <g
                key={p.id}
                style={{ pointerEvents: "auto", cursor: isDragging ? "grabbing" : "grab" }}
                onPointerDown={(e) => onPinPointerDown(e, p.id)}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={fill}
                  stroke="#fff"
                  strokeWidth={4}
                  opacity={isDragging ? 0.85 : 1}
                />

                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  fontWeight={700}
                  fill="#fff"
                  style={{ userSelect: "none", pointerEvents: "none" }}
                >
                  {p.location}
                </text>
              </g>
            );
          })}
        </svg>
        {placingId && (
          <div className="absolute top-2 left-2 right-2 text-[11px] font-mono bg-background/90 border rounded-sm px-2 py-1 flex items-center justify-between gap-2 pointer-events-auto">
            <span>
              Click on the plan to place pin{" "}
              <strong>{pins.find((p) => p.id === placingId)?.location}</strong>
            </span>
            <button
              onClick={() => setPlacingId(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              cancel
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
        <span>
          {placed.length} placed · {unplaced.length} unplaced
        </span>
        <span>Drag any pin to nudge. Overlapping pins can be separated.</span>
      </div>

      {unplaced.length > 0 && (
        <div className="rounded-md border bg-panel/60 p-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Unplaced pins — click one, then click on the plan
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unplaced.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlacingId(p.id === placingId ? null : p.id)}
                className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs transition-colors ${
                  placingId === p.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent"
                }`}
                title={p.cleanedDescription || p.rawDescription}
              >
                <span className="inline-flex items-center justify-center size-5 rounded-full bg-[#c14a2b] text-white font-semibold text-[10px]">
                  {p.location}
                </span>
                <span className="max-w-[180px] truncate">
                  {p.cleanedDescription || p.rawDescription || "—"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
