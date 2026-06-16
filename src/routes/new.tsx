import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState, useCallback } from "react";
import { FileArchive, FilePlus2, FileJson, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { importZipFile } from "@/lib/zip-import";
import { loadReportJson } from "@/lib/project-io";
import { useReportStore } from "@/lib/store";

export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "New job — Report Builder" },
      {
        name: "description",
        content:
          "Drop a Field Reporter ZIP to start a new distress-survey report, or reopen a saved .report.json.",
      },
    ],
  }),
  component: NewJobPage,
});

function NewJobPage() {
  const navigate = useNavigate();
  const loadProject = useReportStore((s) => s.loadProject);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const zipInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        if (/\.report\.json$/i.test(file.name) || file.type === "application/json") {
          const { project, objectUrls } = await loadReportJson(file);
          loadProject(project, objectUrls);
          navigate({ to: "/workspace", search: { job: project.id } });
        } else if (
          /\.zip$/i.test(file.name) ||
          file.type === "application/zip" ||
          file.type === "application/x-zip-compressed"
        ) {
          const { project, objectUrls } = await importZipFile(file);
          loadProject(project, objectUrls);
          navigate({ to: "/workspace", search: { job: project.id } });
        } else {
          throw new Error("Unsupported file. Drop a .zip or .report.json file.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [loadProject, navigate],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDrag(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-panel/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            All jobs
          </Link>
          <span className="text-xs text-muted-foreground font-mono">Step 1 of 2 · Import field ZIP</span>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Start a new job</h1>
        <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
          Drop the export from the Field Reporter app. Photos, pins, and dictated descriptions are unpacked in your browser and saved to this device. After import you'll send the raw notes to Grok for cleanup.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={
            "rounded-md border-2 border-dashed transition-colors p-10 text-center bg-canvas/70 " +
            (drag ? "border-primary bg-accent/60" : "border-rule")
          }
        >
          {busy ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
              <p className="text-sm">Unpacking project…</p>
            </div>
          ) : (
            <>
              <FileArchive className="size-10 mx-auto text-primary mb-3" />
              <p className="text-base font-medium mb-1">
                Drop your Field Reporter <span className="font-mono">.zip</span>
              </p>
              <p className="text-sm text-muted-foreground mb-5">
                or a saved <span className="font-mono">.report.json</span> project
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => zipInput.current?.click()}
                  className="inline-flex items-center gap-2 rounded-sm bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <FilePlus2 className="size-4" />
                  Choose ZIP
                </button>
                <button
                  type="button"
                  onClick={() => jsonInput.current?.click()}
                  className="inline-flex items-center gap-2 rounded-sm border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  <FileJson className="size-4" />
                  Open .report.json
                </button>
              </div>
              <input
                ref={zipInput}
                type="file"
                accept=".zip,application/zip"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
              <input
                ref={jsonInput}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </main>
    </div>
  );
}
