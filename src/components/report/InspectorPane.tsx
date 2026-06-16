import { useState } from "react";
import { useReportStore } from "@/lib/store";
import { useServerFn } from "@tanstack/react-start";
import { cleanupDescription } from "@/lib/cleanup.functions";
import { Sparkles, Undo2, X, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function InspectorPane() {
  const project = useReportStore((s) => s.project)!;
  const selectedPinId = useReportStore((s) => s.selectedPinId);
  const updatePin = useReportStore((s) => s.updatePin);
  const setCleaned = useReportStore((s) => s.setCleanedDescription);
  const revertCleaned = useReportStore((s) => s.revertCleaned);
  const reorderPhoto = useReportStore((s) => s.reorderPhoto);
  const removePhoto = useReportStore((s) => s.removePhotoFromPin);
  const objectUrls = useReportStore((s) => s.objectUrls);
  const cleanup = useServerFn(cleanupDescription);

  const [busy, setBusy] = useState(false);
  const [busyAll, setBusyAll] = useState(false);

  const pin = selectedPinId ? project.pins[selectedPinId] : null;

  const runCleanupAll = async () => {
    setBusyAll(true);
    try {
      const pins = Object.values(project.pins).filter((p) => !p.userEdited);
      let ok = 0;
      let fail = 0;
      for (const p of pins) {
        if (!p.rawDescription.trim()) continue;
        try {
          const res = await cleanup({
            data: {
              raw: p.rawDescription,
              type: p.type,
              location: p.location,
            },
          });
          setCleaned(p.id, res.cleaned, false);
          ok++;
        } catch (e) {
          fail++;
          console.error(e);
        }
      }
      toast.success(`AI cleanup complete`, {
        description: `${ok} updated${fail ? `, ${fail} failed` : ""}.`,
      });
    } finally {
      setBusyAll(false);
    }
  };

  if (!pin) {
    return (
      <div className="p-4 text-sm">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Inspector
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Click any finding in the canvas to inspect, edit raw vs cleaned text,
          reorder photos, and re-run AI cleanup on just that pin.
        </p>
        <div className="mt-6 pt-4 border-t">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Bulk actions
          </p>
          <button
            disabled={busyAll}
            onClick={runCleanupAll}
            className="w-full inline-flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {busyAll ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            Run AI cleanup on all unedited
          </button>
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            Skips any finding you have already hand-edited. Keeps the raw
            dictation untouched so you can always revert.
          </p>
        </div>
      </div>
    );
  }

  const runOne = async () => {
    if (!pin.rawDescription.trim()) {
      toast.error("Nothing to clean", { description: "Raw description is empty." });
      return;
    }
    setBusy(true);
    try {
      const res = await cleanup({
        data: {
          raw: pin.rawDescription,
          type: pin.type,
          location: pin.location,
        },
      });
      setCleaned(pin.id, res.cleaned, false);
      toast.success("Cleaned", {
        description: `Location ${pin.location} updated.`,
      });
    } catch (e) {
      toast.error("AI cleanup failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 space-y-5">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Pin {pin.location}
          </p>
          <h3 className="font-semibold text-sm">{pin.type || "Untyped"}</h3>
        </div>
        {pin.userEdited && (
          <span className="text-[10px] font-mono uppercase tracking-wider rounded-sm bg-accent text-accent-foreground px-1.5 py-0.5">
            edited
          </span>
        )}
      </header>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground col-span-2">
          Pin metadata
        </label>
        <input
          value={pin.location}
          onChange={(e) => updatePin(pin.id, { location: e.target.value })}
          placeholder="Loc"
          className="text-xs px-2 py-1.5 rounded-sm border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          value={pin.type}
          onChange={(e) => updatePin(pin.id, { type: e.target.value })}
          placeholder="Type"
          className="text-xs px-2 py-1.5 rounded-sm border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <section>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Raw dictation
          </label>
        </div>
        <textarea
          value={pin.rawDescription}
          onChange={(e) =>
            updatePin(pin.id, { rawDescription: e.target.value })
          }
          rows={4}
          className="w-full text-xs px-2 py-1.5 rounded-sm border bg-background font-mono leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </section>

      <section>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Cleaned description
          </label>
          <div className="flex gap-1">
            <button
              onClick={() => revertCleaned(pin.id)}
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-sm hover:bg-accent text-muted-foreground hover:text-foreground"
              title="Revert to raw"
            >
              <Undo2 className="size-3" />
              Revert
            </button>
            <button
              onClick={runOne}
              disabled={busy}
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              Run AI
            </button>
          </div>
        </div>
        <textarea
          value={pin.cleanedDescription}
          onChange={(e) => setCleaned(pin.id, e.target.value, true)}
          rows={5}
          className="w-full text-xs px-2 py-1.5 rounded-sm border bg-background leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </section>

      <section>
        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
          Photos ({pin.photos.length})
        </label>
        <ul className="space-y-1.5">
          {pin.photos.map((p, i) => {
            const url = objectUrls[p.filename];
            return (
              <li
                key={p.filename}
                className="flex items-center gap-2 p-1.5 rounded-sm border bg-background"
              >
                <div className="size-12 shrink-0 bg-muted rounded-sm overflow-hidden">
                  {url && (
                    <img
                      src={url}
                      alt={`Photo ${p.n}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono truncate">{p.filename}</p>
                  <input
                    placeholder={`Photo ${p.n}`}
                    value={p.caption ?? ""}
                    onChange={(e) => {
                      const photos = pin.photos.slice();
                      photos[i] = { ...p, caption: e.target.value };
                      updatePin(pin.id, { photos });
                    }}
                    className="w-full text-[11px] mt-0.5 px-1 py-0.5 rounded-sm border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="flex flex-col">
                  <button
                    disabled={i === 0}
                    onClick={() => reorderPhoto(pin.id, i, i - 1)}
                    className="size-5 grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronUp className="size-3" />
                  </button>
                  <button
                    disabled={i === pin.photos.length - 1}
                    onClick={() => reorderPhoto(pin.id, i, i + 1)}
                    className="size-5 grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronDown className="size-3" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Remove ${p.filename} from this pin?`))
                      removePhoto(pin.id, i);
                  }}
                  className="size-6 grid place-items-center text-muted-foreground hover:text-destructive"
                  title="Remove from pin"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
