import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useCallback, useEffect } from "react";
import { FileArchive, FilePlus2, FileJson, Loader2, AlertTriangle } from "lucide-react";
import { importZipFile } from "@/lib/zip-import";
import { loadReportJson } from "@/lib/project-io";
import { useReportStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Report Builder — Drop your Field Reporter export" },
      {
        name: "description",
        content:
          "Drop a Field Reporter ZIP to start a new distress-survey report, or reopen a saved project.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const loadProject = useReportStore((s) => s.loadProject);
  const hydrate = useReportStore((s) => s.hydrateFromDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const zipInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasDraft(!!localStorage.getItem("report-builder.draft.v1"));
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        if (/\.report\.json$/i.test(file.name) || file.type === "application/json") {
          const { project, objectUrls } = await loadReportJson(file);
          loadProject(project, objectUrls);
        } else if (
          /\.zip$/i.test(file.name) ||
          file.type === "application/zip" ||
          file.type === "application/x-zip-compressed"
        ) {
          const { project, objectUrls } = await importZipFile(file);
          loadProject(project, objectUrls);
        } else {
          throw new Error("Unsupported file. Drop a .zip or .report.json file.");
        }
        navigate({ to: "/workspace" });
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

  const resumeDraft = () => {
    if (hydrate()) navigate({ to: "/workspace" });
    else setError("No draft was recoverable.");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-panel/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-sm bg-primary text-primary-foreground flex items-center justify-center font-mono text-[11px] font-semibold">
              RB
            </div>
            <span className="font-semibold tracking-tight">Report Builder</span>
            <span className="text-xs text-muted-foreground font-mono ml-2">
              v1 · local · no account
            </span>
          </div>
          <a
            href="https://docs.lovable.dev"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Docs
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12">
        <div className="grid md:grid-cols-[1.4fr_1fr] gap-10 items-start">
          <section>
            <p className="text-xs font-mono text-primary uppercase tracking-widest mb-3">
              Distress survey · desk assembly
            </p>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] mb-4">
              Turn the field ZIP into a polished report.
            </h1>
            <p className="text-muted-foreground text-base mb-8 max-w-prose leading-relaxed">
              Drop the export from the Field Reporter app or the Survey Sorter.
              Photos, pins, and dictated descriptions are unpacked into editable
              findings — with AI cleanup that keeps your voice. You stay in
              control of every word.
            </p>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
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

            {hasDraft && !busy && (
              <button
                onClick={resumeDraft}
                className="mt-4 text-sm text-primary hover:underline"
              >
                Resume last draft from this browser →
              </button>
            )}
          </section>

          <aside className="rounded-md border bg-panel p-6 text-sm">
            <h2 className="font-semibold mb-3 text-foreground">
              Expected ZIP contents
            </h2>
            <ul className="space-y-2 font-mono text-xs text-muted-foreground">
              <li>
                <span className="text-foreground">pins.csv</span> — Location, Type,
                Description, Photo Count, Photo Numbers
              </li>
              <li>
                <span className="text-foreground">plan.png</span> or{" "}
                <span className="text-foreground">plan.pdf</span>
              </li>
              <li>
                <span className="text-foreground">photo-01.jpg</span> …{" "}
                <span className="text-foreground">photo-NN.jpg</span>
              </li>
            </ul>
            <hr className="my-4 border-rule" />
            <h3 className="font-semibold mb-2 text-foreground">What happens next</h3>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Photos and pins unpacked in your browser.</li>
              <li>One finding row generated per pin.</li>
              <li>AI cleans each dictated description; raw stays one click away.</li>
              <li>You edit, reorder, then copy-paste or save.</li>
            </ol>
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
              Nothing leaves your browser except the description text sent for AI
              cleanup. Photos stay local.
            </p>
          </aside>
        </div>
      </main>

      <footer className="border-t bg-panel/40">
        <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-muted-foreground flex items-center justify-between">
          <span>Report Builder — sibling tool to Field Reporter & Survey Sorter</span>
          <span className="font-mono">{new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
