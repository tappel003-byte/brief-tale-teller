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
      if (project && (!search.job || project.id === search.job)) {
        setLoading(false);
        return;
      }
      if (search.job) {
        setLoading(true);
        const ok = await loadJobById(search.job);
        setLoading(false);
        if (!cancelled && !ok) navigate({ to: "/" });
        return;
      }
      if (!hydrate()) navigate({ to: "/" });
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [project, search.job, loadJobById, hydrate, navigate]);

  const pins = useMemo(() => (project ? Object.values(project.pins) : []), [project]);
  const photoItems: PhotoPlateItem[] = useMemo(() => {
    const seen = new Set<number>();
    const out: PhotoPlateItem[] = [];
    for (const pin of [...pins].sort(
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

  if (loading || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading job…
      </div>
    );
  }

  const editedCount = pins.filter((p) => p.userEdited).length;
  const stages = [
    {
      n: 1,
      key: "import",
      title: "Import",
      hint: "Grok round-trip",
      done: project.grokImported,
    },
    {
      n: 2,
      key: "clean",
      title: "Clean",
      hint: `${pins.length} pins · ${editedCount} edited`,
      done: pins.length > 0 && project.grokImported,
    },
    {
      n: 3,
      key: "arrange",
      title: "Arrange",
      hint: "Map & layout",
      done: false,
    },
    {
      n: 4,
      key: "export",
      title: "Export",
      hint: `${photoItems.length} photos`,
      done: false,
    },
  ];
  const activeIdx = stages.findIndex((s) => !s.done);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-panel/60 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground shrink-0"
          >
            <ArrowLeft className="size-4" />
            All jobs
          </Link>
          <div className="flex-1 min-w-0 text-center">
            <div className="font-semibold tracking-tight truncate">{project.name}</div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {pins.length} pins · {photoItems.length} photos
            </div>
          </div>
          <div className="shrink-0">
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
        <div className="border-t bg-background/60">
          <div className="max-w-6xl mx-auto px-6 py-2 flex items-stretch gap-2">
            {stages.map((s, i) => {
              const active = i === activeIdx || (activeIdx === -1 && i === stages.length - 1);
              return (
                <a
                  key={s.key}
                  href={`#stage-${s.key}`}
                  className={`flex-1 min-w-0 rounded-sm border px-3 py-1.5 flex items-center gap-2 transition-colors ${
                    active
                      ? "bg-primary/5 border-primary/40"
                      : "bg-panel/40 border-transparent hover:border-border"
                  }`}
                >
                  <span
                    className={`size-5 rounded-full text-[10px] font-mono font-semibold flex items-center justify-center shrink-0 ${
                      s.done
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.done ? "✓" : s.n}
                  </span>
                  <div className="min-w-0 leading-tight text-left">
                    <div className="text-xs font-medium truncate">{s.title}</div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">
                      {s.hint}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 space-y-10">
        <Stage
          n={1}
          id="stage-import"
          title="Import"
          subtitle="Round-trip the raw descriptions through Grok to clean them up."
        >
          <button
            onClick={() => setGrokOpen(true)}
            className="w-full text-left rounded-md border bg-panel p-4 hover:bg-accent/40 transition-colors flex items-start gap-3"
          >
            <div className="size-10 rounded-sm bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium mb-0.5">
                {project.grokImported
                  ? "Re-run Grok cleanup"
                  : "Copy Grok prompt, paste cleaned CSV"}
              </div>
              <div className="text-xs text-muted-foreground">
                Opens the round-trip dialog. Copy the prompt, paste into Grok, paste the returned CSV back here.
              </div>
            </div>
          </button>
        </Stage>

        <Stage
          n={2}
          id="stage-clean"
          title="Clean"
          subtitle="Review each pin's description and swap or reorder photos. Click a row to expand."
        >
          <PinEditor pins={pins} objectUrls={objectUrls} />
        </Stage>

        <Stage
          n={3}
          id="stage-arrange"
          title="Arrange & Export"
          subtitle="Pick the map, dial in layout, then drop the ZIP into your 11×17 template."
        >
          <ExportCard
            project={project}
            pins={pins}
            photoItems={photoItems}
          />
        </Stage>
      </main>

      {grokOpen && <GrokDialog onClose={() => setGrokOpen(false)} />}
    </div>
  );
}

function Stage({
  n,
  id,
  title,
  subtitle,
  children,
}: {
  n: number;
  id: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
          Stage {n}
        </span>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4 max-w-2xl">{subtitle}</p>
      {children}
    </section>
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
  const [captionFontFamily, setCaptionFontFamily] = useState<string>(
    `Calibri, "Carlito", Arial, sans-serif`,
  );
  const [labelSize, setLabelSize] = useState<number>(22);
  const [captionSize, setCaptionSize] = useState<number>(20);
  const [maxLines, setMaxLines] = useState<number>(4);
  const [busy, setBusy] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<{
    schedule?: string;
    plate?: string;
  }>({});

  const effectivePerPage = perPage || autoPerPage(photoItems.length);
  const plateCount = photoItems.length
    ? Math.ceil(photoItems.length / effectivePerPage)
    : 0;

  const coverSection = project.sections.find((s) => s.kind === "cover") as
    | import("@/lib/types").CoverSection
    | undefined;
  const updateSection = useReportStore((s) => s.updateSection);
  const mapFilename = coverSection?.planFilename;
  const mapAsset = mapFilename ? project.assets[mapFilename] : undefined;

  // All non-photo assets — candidates for the map/plan.
  const mapCandidates = useMemo(
    () =>
      Object.keys(project.assets).filter(
        (fn) => !/^photo-\d+\.(jpe?g|png|webp)$/i.test(fn),
      ),
    [project.assets],
  );

  // Auto-preview whenever settings change (debounced).
  useEffect(() => {
    if (!pins.length && !photoItems.length) return;
    const t = setTimeout(() => {
      void renderPreview();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleColumns, perPage, fontFamily, labelSize, captionSize, maxLines]);

  async function renderPreview() {
    try {
      const sortedPins = [...pins].sort(
        (a, b) => (parseInt(a.location) || 9999) - (parseInt(b.location) || 9999),
      );
      const next: typeof previewUrls = {};
      if (sortedPins.length) {
        const blob = await renderPinScheduleJpeg(sortedPins, {
          scheduleColumns,
          width: 900,
          quality: 0.6,
        });
        next.schedule = URL.createObjectURL(blob);
      }
      if (photoItems.length) {
        const plates = await renderPhotoPlates(photoItems, {
          perPage: perPage || undefined,
          fontFamily,
          labelSize,
          captionSize,
          maxCaptionLines: maxLines,
          width: 1400,
          height: 800,
          quality: 0.6,
        });
        if (plates[0]) next.plate = URL.createObjectURL(plates[0].blob);
      }
      setPreviewUrls((prev) => {
        // revoke old URLs to avoid memory leaks
        if (prev.schedule && prev.schedule !== next.schedule)
          URL.revokeObjectURL(prev.schedule);
        if (prev.plate && prev.plate !== next.plate)
          URL.revokeObjectURL(prev.plate);
        return next;
      });
    } catch {
      /* preview failures are silent */
    }
  }

  async function onExport() {
    setBusy(true);
    try {
      const zip = new JSZip();
      const cover = project.sections.find((s) => s.kind === "cover") as
        | import("@/lib/types").CoverSection
        | undefined;
      const base = slug(cover?.address || project.name);
      const zipName = `${base}-report-pieces.zip`;

      // 1. Map — original file, unchanged.
      if (mapAsset) {
        const ext = (mapFilename!.split(".").pop() || "bin").toLowerCase();
        zip.file(`${base}-map.${ext}`, base64ToBlob(mapAsset.base64, mapAsset.mime));
      }

      // 2. Pin schedule — one JPEG with side-by-side columns.
      const sortedPins = [...pins].sort(
        (a, b) => (parseInt(a.location) || 9999) - (parseInt(b.location) || 9999),
      );
      const scheduleBlob = await renderPinScheduleJpeg(sortedPins, { scheduleColumns });
      zip.file(`${base}-pin-schedule.jpg`, scheduleBlob);

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
      downloadBlob(zipBlob, zipName);
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
    <div className="space-y-4">
      {/* Settings — map picker + optional typography. */}
      <div className="rounded-md border bg-panel/60 p-4">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
          Other settings
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Map */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Map / plan file
            </label>
            {mapCandidates.length > 0 ? (
              <select
                value={mapFilename ?? ""}
                onChange={(e) => {
                  if (!coverSection) return;
                  updateSection(coverSection.id, { planFilename: e.target.value || undefined });
                }}
                className="w-full text-sm rounded-sm border border-input bg-background px-2 py-1.5"
              >
                <option value="">— none —</option>
                {mapCandidates.map((fn) => (
                  <option key={fn} value={fn}>
                    {fn}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-amber-600 font-mono">
                No non-photo files found in import.
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Exported as-is so you can resize it inside your template.
            </p>
          </div>
        </div>


        <details className="mt-4 group" open>
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none inline-flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
            Typography (font, sizes, caption lines)
          </summary>
          <div className="grid gap-3 md:grid-cols-4 mt-3">
            <div>
              <label className="block text-[11px] mb-1 text-muted-foreground">Font</label>
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
              <label className="block text-[11px] mb-1 text-muted-foreground">Label px</label>
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
              <label className="block text-[11px] mb-1 text-muted-foreground">Caption px</label>
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
              <label className="block text-[11px] mb-1 text-muted-foreground">Max caption lines</label>
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
        </details>
      </div>

      {/* HERO: live preview is the headline. */}
      <div className="rounded-md border bg-canvas/60 p-4 shadow-[var(--shadow-canvas)]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Live preview
            </div>
            <div className="text-sm font-medium">
              What gets dropped into your template
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground font-mono">
            {plateCount} plate{plateCount === 1 ? "" : "s"} · {scheduleColumns}-col schedule
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <figure className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <figcaption className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Pin schedule
              </figcaption>
              <label className="text-[11px] font-mono text-muted-foreground inline-flex items-center gap-1.5">
                Columns
                <select
                  value={scheduleColumns}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setScheduleColumns((v === 2 || v === 3 || v === 4) ? v : 1);
                  }}
                  className="text-xs rounded-sm border border-input bg-background px-1.5 py-0.5"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </label>
            </div>
            {previewUrls.schedule ? (
              <img
                src={previewUrls.schedule}
                alt="Pin schedule preview"
                className="w-full rounded-sm border bg-white shadow-sm"
              />
            ) : (
              <div className="aspect-[3/4] rounded-sm border border-dashed flex items-center justify-center text-xs text-muted-foreground italic bg-background/40">
                No pins yet
              </div>
            )}
          </figure>
          <figure className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <figcaption className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Photo plate · page 1 of {plateCount || 1}
              </figcaption>
              <label className="text-[11px] font-mono text-muted-foreground inline-flex items-center gap-1.5">
                Layout
                <select
                  value={perPage}
                  onChange={(e) => setPerPage(parseInt(e.target.value))}
                  className="text-xs rounded-sm border border-input bg-background px-1.5 py-0.5"
                >
                  <option value={0}>Auto ({autoPerPage(photoItems.length)})</option>
                  <option value={6}>6 (3×2)</option>
                  <option value={8}>8 (4×2)</option>
                  <option value={10}>10 (5×2)</option>
                  <option value={12}>12 (4×3)</option>
                </select>
              </label>
            </div>
            {previewUrls.plate ? (
              <img
                src={previewUrls.plate}
                alt="Photo plate preview"
                className="w-full rounded-sm border bg-white shadow-sm"
              />
            ) : (
              <div className="aspect-[7/4] rounded-sm border border-dashed flex items-center justify-center text-xs text-muted-foreground italic bg-background/40">
                No photos yet
              </div>
            )}
          </figure>
        </div>


        <div className="mt-4 pt-4 border-t flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground font-mono space-y-0.5">
            <div>
              map:{" "}
              {mapAsset ? (
                <span className="text-foreground">{mapFilename}</span>
              ) : (
                <span className="text-amber-600">
                  {mapCandidates.length > 0 ? "pick one below" : "not found in import"}
                </span>
              )}
            </div>
            <div>
              output: {plateCount + (pins.length ? 1 : 0) + (mapAsset ? 1 : 0)} JPEG{plateCount + 1 === 1 ? "" : "s"} · 1 ZIP
            </div>
          </div>
          <button
            onClick={onExport}
            disabled={busy || (pins.length === 0 && photoItems.length === 0)}
            className="inline-flex items-center gap-2 rounded-sm bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Export ZIP
          </button>
        </div>
      </div>
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

function PinEditor({
  pins,
  objectUrls,
}: {
  pins: import("@/lib/types").Pin[];
  objectUrls: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [picker, setPicker] = useState<{ pinId: string; idx: number | "add" } | null>(null);
  const setCleanedDescription = useReportStore((s) => s.setCleanedDescription);
  const revertCleaned = useReportStore((s) => s.revertCleaned);
  const reorderPhoto = useReportStore((s) => s.reorderPhoto);
  const removePhotoFromPin = useReportStore((s) => s.removePhotoFromPin);
  const updatePin = useReportStore((s) => s.updatePin);
  const project = useReportStore((s) => s.project)!;

  // Pool of every photo-NN asset in the project, sorted by number.
  const photoPool = useMemo(() => {
    const out: { filename: string; n: number }[] = [];
    for (const fn of Object.keys(project.assets)) {
      const m = fn.match(/^photo-(\d+)\.(jpe?g|png|webp)$/i);
      if (m) out.push({ filename: fn, n: parseInt(m[1], 10) });
    }
    return out.sort((a, b) => a.n - b.n);
  }, [project.assets]);

  const sorted = [...pins].sort(
    (a, b) => (parseInt(a.location) || 9999) - (parseInt(b.location) || 9999),
  );

  function applyPick(filename: string, n: number) {
    if (!picker) return;
    const pin = project.pins[picker.pinId];
    if (!pin) return;
    const photos = [...pin.photos];
    if (picker.idx === "add") {
      photos.push({ n, filename });
    } else {
      photos[picker.idx] = { ...photos[picker.idx], filename, n };
    }
    updatePin(picker.pinId, { photos });
    setPicker(null);
  }

  return (
    <div className="rounded-md border bg-panel overflow-hidden">
      <div className="max-h-[60vh] overflow-auto thin-scroll">
        {sorted.map((pin) => {
          const isOpen = expanded.has(pin.id);
          return (
            <div key={pin.id} className="border-b last:border-0">
              <button
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(pin.id)) next.delete(pin.id);
                    else next.add(pin.id);
                    return next;
                  })
                }
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
              >
                <span className="font-mono text-sm font-semibold w-8 shrink-0">
                  {pin.location}
                </span>
                <span className="text-sm flex-1 truncate text-left">
                  {pin.cleanedDescription || pin.rawDescription || "No description"}
                </span>
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {pin.photos.length} photo{pin.photos.length === 1 ? "" : "s"}
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 bg-canvas/40">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Description
                      </label>
                      <textarea
                        className="w-full text-sm rounded-sm border border-input bg-background px-2 py-1.5 min-h-[80px] resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                        value={pin.cleanedDescription || ""}
                        onChange={(e) =>
                          setCleanedDescription(pin.id, e.target.value, true)
                        }
                        placeholder="Edit description..."
                      />
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          onClick={() => revertCleaned(pin.id)}
                          className="text-xs text-muted-foreground hover:text-foreground underline"
                        >
                          Revert to raw
                        </button>
                        {pin.userEdited && (
                          <span className="text-[10px] text-emerald-600 font-mono">
                            edited
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Photos — click a photo to swap it
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {pin.photos.map((ph, idx) => {
                          const src = objectUrls[ph.filename];
                          return (
                            <div
                              key={`${ph.filename}-${idx}`}
                              className="relative group w-20 h-20 rounded-sm border bg-white overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => setPicker({ pinId: pin.id, idx })}
                                className="absolute inset-0 w-full h-full"
                                title="Swap photo"
                              >
                                {src ? (
                                  <img
                                    src={src}
                                    alt={`Photo ${ph.n}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                                    {ph.n}
                                  </div>
                                )}
                              </button>
                              <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] font-mono px-1 py-0.5 flex items-center justify-between pointer-events-none">
                                <span>#{ph.n}</span>
                              </div>
                              <div className="absolute top-0 right-0 flex">
                                {idx > 0 && (
                                  <button
                                    onClick={() => reorderPhoto(pin.id, idx, idx - 1)}
                                    className="bg-black/60 text-white text-[10px] px-1 hover:bg-black"
                                    title="Move left"
                                  >
                                    ←
                                  </button>
                                )}
                                {idx < pin.photos.length - 1 && (
                                  <button
                                    onClick={() => reorderPhoto(pin.id, idx, idx + 1)}
                                    className="bg-black/60 text-white text-[10px] px-1 hover:bg-black"
                                    title="Move right"
                                  >
                                    →
                                  </button>
                                )}
                                <button
                                  onClick={() => removePhotoFromPin(pin.id, idx)}
                                  className="bg-black/60 text-white text-[10px] px-1 hover:bg-destructive"
                                  title="Remove"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setPicker({ pinId: pin.id, idx: "add" })}
                          className="w-20 h-20 rounded-sm border-2 border-dashed border-muted-foreground/40 text-xs text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                          title="Add photo"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {picker && (
        <PhotoPicker
          pool={photoPool}
          objectUrls={objectUrls}
          onPick={applyPick}
          onClose={() => setPicker(null)}
          mode={picker.idx === "add" ? "add" : "swap"}
        />
      )}
    </div>
  );
}

function PhotoPicker({
  pool,
  objectUrls,
  onPick,
  onClose,
  mode,
}: {
  pool: { filename: string; n: number }[];
  objectUrls: Record<string, string>;
  onPick: (filename: string, n: number) => void;
  onClose: () => void;
  mode: "swap" | "add";
}) {
  const [q, setQ] = useState("");
  const filtered = q
    ? pool.filter(
        (p) =>
          p.filename.toLowerCase().includes(q.toLowerCase()) ||
          String(p.n).includes(q),
      )
    : pool;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-md border shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b">
          <div className="text-sm font-semibold">
            {mode === "add" ? "Add photo" : "Swap photo"} — pick from {pool.length}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ✕
          </button>
        </div>
        <div className="p-3 border-b">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by number or filename…"
            className="w-full text-sm rounded-sm border border-input bg-background px-2 py-1.5"
          />
        </div>
        <div className="overflow-auto p-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
          {filtered.map((p) => {
            const src = objectUrls[p.filename];
            return (
              <button
                key={p.filename}
                type="button"
                onClick={() => onPick(p.filename, p.n)}
                className="relative aspect-square rounded-sm border bg-white overflow-hidden hover:ring-2 hover:ring-primary"
                title={p.filename}
              >
                {src && (
                  <img src={src} alt={`Photo ${p.n}`} className="w-full h-full object-cover" />
                )}
                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] font-mono px-1 py-0.5 text-left">
                  #{p.n}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-6">
              No matches.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

