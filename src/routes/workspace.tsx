import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import JSZip from "jszip";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Download,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Table as TableIcon,
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
          <div className="grid gap-4 md:grid-cols-2">
            <PinScheduleCard project={project} pins={pins} />
            <PhotoPlatesCard
              jobName={project.name}
              items={photoItems}
            />
          </div>
        </section>
      </main>

      {grokOpen && <GrokDialog onClose={() => setGrokOpen(false)} />}
    </div>
  );
}

function PinScheduleCard({
  project,
  pins,
}: {
  project: { name: string };
  pins: ReturnType<typeof Object.values<import("@/lib/types").Pin>>;
}) {
  const [busy, setBusy] = useState(false);

  async function onExport() {
    setBusy(true);
    try {
      const blob = await renderPinScheduleJpeg(pins);
      downloadBlob(blob, `${slug(project.name)}-pin-schedule.jpg`);
      toast.success("Pin schedule exported");
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
        <TableIcon className="size-4 text-primary" />
        <h3 className="font-medium">Pin Schedule</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        2-column table — PIN / DESCRIPTION with photos inline. Dark header, alternating grey stripes. Natural width, no 11×17 forcing.
      </p>

      <button
        onClick={onExport}
        disabled={busy || pins.length === 0}
        className="inline-flex items-center gap-2 rounded-sm bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        Export JPEG
      </button>
    </div>
  );
}

function PhotoPlatesCard({
  jobName,
  items,
}: {
  jobName: string;
  items: PhotoPlateItem[];
}) {
  const [perPage, setPerPage] = useState<number>(0); // 0 = auto
  const [busy, setBusy] = useState(false);

  const effectivePerPage = perPage || autoPerPage(items.length);
  const pageCount = items.length
    ? Math.ceil(items.length / effectivePerPage)
    : 0;

  async function onExport() {
    setBusy(true);
    try {
      const plates = await renderPhotoPlates(items, {
        perPage: perPage || undefined,
      });
      if (plates.length === 1) {
        downloadBlob(plates[0].blob, `${slug(jobName)}-photo-plate.jpg`);
      } else {
        const zip = new JSZip();
        for (const p of plates) {
          zip.file(
            `${slug(jobName)}-plate-${String(p.index + 1).padStart(2, "0")}.jpg`,
            p.blob,
          );
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `${slug(jobName)}-photo-plates.zip`);
      }
      toast.success(`Exported ${plates.length} plate${plates.length === 1 ? "" : "s"}`);
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
        <ImageIcon className="size-4 text-primary" />
        <h3 className="font-medium">Photo Plates</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        White-background JPEG(s) of the photo grid with bold <span className="font-mono">Photo NN</span> labels and Grok captions. Drops into the empty area on your 11×17 template.
      </p>
      <label className="block text-sm mb-1">Photos per page</label>
      <select
        value={perPage}
        onChange={(e) => setPerPage(parseInt(e.target.value))}
        className="text-sm rounded-sm border border-input bg-background px-2 py-1 mb-4"
      >
        <option value={0}>Auto ({autoPerPage(items.length)})</option>
        <option value={6}>6 (3×2)</option>
        <option value={8}>8 (4×2)</option>
        <option value={10}>10 (5×2)</option>
        <option value={12}>12 (4×3)</option>
      </select>
      <div className="text-xs text-muted-foreground font-mono mb-3">
        {items.length} photos → {pageCount} page{pageCount === 1 ? "" : "s"}
      </div>
      <button
        onClick={onExport}
        disabled={busy || items.length === 0}
        className="inline-flex items-center gap-2 rounded-sm bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        {pageCount > 1 ? "Export ZIP" : "Export JPEG"}
      </button>
    </div>
  );
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
