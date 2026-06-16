import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import JSZip from "jszip";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Download,
  Loader2,
  Sparkles,
} from "lucide-react";

import { useReportStore } from "@/lib/store";
import { GrokDialog } from "@/components/report/GrokDialog";
import { renderPinScheduleJpeg } from "@/lib/export-pin-schedule";
import {
  renderPhotoPlates,
  type PhotoPlateItem,
} from "@/lib/export-photo-plates";
import { toast } from "sonner";

const SearchSchema = z.object({ job: z.string().optional() });

export const Route = createFileRoute("/workspace")({
  validateSearch: (s) => SearchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Job — Report Builder" },
      {
        name: "description",
        content:
          "Run a Grok round-trip and export the pin schedule and photo plates as drop-in JPEGs.",
      },
    ],
  }),
  component: JobPage,
});

function JobPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const project = useReportStore((s) => s.project);
  const objectUrls = useReportStore((s) => s.objectUrls);
  const loadJobById = useReportStore((s) => s.loadJobById);
  const hydrate = useReportStore((s) => s.hydrateFromDraft);
  const [loading, setLoading] = useState(false);
  const [grokOpen, setGrokOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (project && (!search.job || project.id === search.job)) return;
      if (search.job) {
        setLoading(true);
        const ok = await loadJobById(search.job);
        if (!cancelled) {
          setLoading(false);
          if (!ok) navigate({ to: "/" });
        }
        return;
      }
      if (!hydrate()) navigate({ to: "/" });
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [project, search.job, loadJobById, hydrate, navigate]);

  if (loading || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading job…
      </div>
    );
  }

  const pins = Object.values(project.pins);
  const photoItems: PhotoPlateItem[] = useMemo(() => {
    const seen = new Set<number>();
    const out: PhotoPlateItem[] = [];
    for (const pin of pins.sort(
      (a, b) => (parseInt(a.location) || 9999) - (parseInt(b.location) || 9999),
    )) {
      const caption =
        pin.cleanedDescription || pin.rawDescription || `Pin ${pin.location}`;
      for (const ph of pin.photos) {
        if (seen.has(ph.n)) continue;
        seen.add(ph.n);
        const src = objectUrls[ph.filename];
        if (!src) continue;
        out.push({ n: ph.n, caption, src });
      }
    }
    return out.sort((a, b) => a.n - b.n);
  }, [pins, objectUrls]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-panel/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            All jobs
          </Link>
          <div className="flex items-center gap-2">
            {project.grokImported ? (
              <span className="text-[11px] font-mono inline-flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="size-3" />
                Grok imported
              </span>
            ) : (
              <span className="text-[11px] font-mono inline-flex items-center gap-1 text-amber-600">
                <CircleAlert className="size-3" />
                Needs Grok CSV
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">
          {project.name}
        </h1>
        <p className="text-sm text-muted-foreground mb-8 font-mono">
          {pins.length} pins · {photoItems.length} photos
        </p>

        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Step 1 · Grok round-trip
          </h2>
          <button
            onClick={() => setGrokOpen(true)}
            className="w-full text-left rounded-md border bg-panel p-4 hover:bg-accent/40 transition-colors flex items-start gap-3"
          >
            <div className="size-9 rounded-sm bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium mb-0.5">
                {project.grokImported
                  ? "Re-run Grok cleanup"
                  : "Copy Grok prompt, paste cleaned CSV"}
              </div>
              <div className="text-xs text-muted-foreground">
                Opens the round-trip dialog: copy the pre-filled prompt, paste it into Grok, paste the returned CSV back here.
              </div>
            </div>
          </button>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Step 2 · Export
          </h2>
          <ExportCard
            project={project}
            pins={pins}
            photoItems={photoItems}
          />
        </section>
      </main>

      {grokOpen && <GrokDialog onClose={() => setGrokOpen(false)} />}
    </div>
  );
}

function ExportCard({
  project,
  pins,
  photoItems,
}: {
  project: import("@/lib/types").ReportProject;
  pins: import("@/lib/types").Pin[];
  photoItems: PhotoPlateItem[];
}) {
  const [scheduleColumns, setScheduleColumns] = useState<1 | 2 | 3 | 4>(1);
  const [perPage, setPerPage] = useState<number>(0); // 0 = auto
  const [fontFamily, setFontFamily] = useState<string>(
    `Calibri, "Carlito", Arial, sans-serif`,
  );
  const [labelSize, setLabelSize] = useState<number>(22);
  const [captionSize, setCaptionSize] = useState<number>(20);
  const [maxLines, setMaxLines] = useState<number>(4);
  const [busy, setBusy] = useState(false);

  const effectivePerPage = perPage || autoPerPage(photoItems.length);
  const plateCount = photoItems.length
    ? Math.ceil(photoItems.length / effectivePerPage)
    : 0;

  const coverSection = project.sections.find((s) => s.kind === "cover") as
    | { planFilename?: string }
    | undefined;
  const mapFilename = coverSection?.planFilename;
  const mapAsset = mapFilename ? project.assets[mapFilename] : undefined;

  async function onExport() {
    setBusy(true);
    try {
      const zip = new JSZip();
      const base = slug(project.name);

      // 1. Map — original file, unchanged.
      if (mapAsset) {
        const ext = (mapFilename!.split(".").pop() || "bin").toLowerCase();
        zip.file(`${base}-map.${ext}`, base64ToBlob(mapAsset.base64, mapAsset.mime));
      }

      // 2. Pin schedule — N jpgs, one per column (pins split evenly across columns).
      const sortedPins = [...pins].sort(
        (a, b) => (parseInt(a.location) || 9999) - (parseInt(b.location) || 9999),
      );
      if (scheduleColumns === 1) {
        const blob = await renderPinScheduleJpeg(sortedPins, { scheduleColumns: 1 });
        zip.file(`${base}-pin-schedule.jpg`, blob);
      } else {
        const chunkSize = Math.ceil(sortedPins.length / scheduleColumns);
        const chunks: typeof sortedPins[] = [];
        for (let i = 0; i < scheduleColumns; i++) {
          chunks.push(sortedPins.slice(i * chunkSize, (i + 1) * chunkSize));
        }
        const blobs = await Promise.all(
          chunks.map((c) => renderPinScheduleJpeg(c, { scheduleColumns: 1 })),
        );
        blobs.forEach((b, i) => {
          const n = String(i + 1).padStart(2, "0");
          zip.file(`${base}-pin-schedule-${n}.jpg`, b);
        });
      }

      // 3. Photo plates — all pages.
      const plates = await renderPhotoPlates(photoItems, {
        perPage: perPage || undefined,
        fontFamily,
        labelSize,
        captionSize,
        maxCaptionLines: maxLines,
      });
      for (const p of plates) {
        const name =
          plates.length === 1
            ? `${base}-photo-plate.jpg`
            : `${base}-photo-plate-${String(p.index + 1).padStart(2, "0")}.jpg`;
        zip.file(name, p.blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `${base}-export.zip`);
      toast.success("Export complete");
    } catch (e) {
      toast.error("Export failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border bg-panel p-4">
      <div className="flex items-center gap-2 mb-2">
        <Download className="size-4 text-primary" />
        <h3 className="font-medium">Job Export</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        One zip with the map, pin schedule(s), and all photo plates.
        Drop the folder into your 11×17 template.
      </p>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Pin Schedule
          </div>
          <label className="block text-sm mb-1">Schedule layout</label>
          <select
            value={scheduleColumns}
            onChange={(e) =>
              setScheduleColumns(parseInt(e.target.value, 10) === 2 ? 2 : 1)
            }
            className="w-full text-sm rounded-sm border border-input bg-background px-2 py-1"
          >
            <option value={1}>1 column → 1 JPEG</option>
            <option value={2}>2 columns → 2 JPEGs</option>
          </select>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Photo Plates
          </div>
          <label className="block text-sm mb-1">Photos per page</label>
          <select
            value={perPage}
            onChange={(e) => setPerPage(parseInt(e.target.value))}
            className="w-full text-sm rounded-sm border border-input bg-background px-2 py-1"
          >
            <option value={0}>Auto ({autoPerPage(photoItems.length)})</option>
            <option value={6}>6 (3×2)</option>
            <option value={8}>8 (4×2)</option>
            <option value={10}>10 (5×2)</option>
            <option value={12}>12 (4×3)</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4 mb-4">
        <div className="md:col-span-1">
          <label className="block text-xs mb-1">Font</label>
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="w-full text-sm rounded-sm border border-input bg-background px-2 py-1"
          >
            <option value={`Calibri, "Carlito", Arial, sans-serif`}>Calibri</option>
            <option value={`Arial, sans-serif`}>Arial</option>
            <option value={`"Helvetica Neue", Helvetica, Arial, sans-serif`}>Helvetica</option>
            <option value={`Georgia, "Times New Roman", serif`}>Georgia</option>
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Label px</label>
          <input
            type="number"
            min={10}
            max={48}
            value={labelSize}
            onChange={(e) => setLabelSize(parseInt(e.target.value) || 22)}
            className="w-full text-sm rounded-sm border border-input bg-background px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-xs mb-1">Caption px</label>
          <input
            type="number"
            min={8}
            max={40}
            value={captionSize}
            onChange={(e) => setCaptionSize(parseInt(e.target.value) || 20)}
            className="w-full text-sm rounded-sm border border-input bg-background px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-xs mb-1">Max lines</label>
          <input
            type="number"
            min={1}
            max={8}
            value={maxLines}
            onChange={(e) => setMaxLines(parseInt(e.target.value) || 4)}
            className="w-full text-sm rounded-sm border border-input bg-background px-2 py-1"
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground font-mono mb-3 space-y-0.5">
        <div>map: {mapAsset ? mapFilename : <span className="text-amber-600">not found in import</span>}</div>
        <div>pin schedule: {scheduleColumns === 1 ? "1 JPEG" : "2 JPEGs"}</div>
        <div>photo plates: {plateCount} JPEG{plateCount === 1 ? "" : "s"} ({photoItems.length} photos)</div>
      </div>

      <button
        onClick={onExport}
        disabled={busy || (pins.length === 0 && photoItems.length === 0)}
        className="inline-flex items-center gap-2 rounded-sm bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        Export ZIP
      </button>
    </div>
  );
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function autoPerPage(total: number): number {
  if (total <= 6) return Math.max(total, 1);
  if (total <= 10) return total;
  return 10;
}


function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "job";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
