import { useState } from "react";
import { Copy, CheckCircle2, Sparkles, AlertCircle, Mic, Download } from "lucide-react";
import { useReportStore } from "@/lib/store";
import { buildGrokPrompt } from "@/lib/grok-prompt";
import { parseGrokCsv, type ParseResult } from "@/lib/grok-csv";
import { toast } from "sonner";

export function GrokDialog({ onClose }: { onClose: () => void }) {
  const project = useReportStore((s) => s.project)!;
  const objectUrls = useReportStore((s) => s.objectUrls);
  const applyGrok = useReportStore((s) => s.applyGrok);

  const [copied, setCopied] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const promptText = buildGrokPrompt(project);
  const audioClips = project.audioClips ?? [];

  async function onCopyPrompt() {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — select the textbox and Cmd+C");
    }
  }

  function onParse(text: string) {
    setCsvText(text);
    setError(null);
    setPreview(null);
    if (!text.trim()) return;
    try {
      setPreview(parseGrokCsv(text, project));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onFile(file: File) {
    const text = await file.text();
    onParse(text);
  }

  function onApply() {
    if (!preview) return;
    applyGrok(preview.rows, preview.interviewNotes);
    const notesMsg = preview.interviewNotes ? " + Interview Notes" : "";
    toast.success(`Applied ${preview.rows.length} cleaned rows${notesMsg}`);
    onClose();
  }


  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-stretch justify-center p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-md border shadow-lg w-full max-w-6xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="font-semibold">Grok round-trip</h2>
            <span className="text-xs text-muted-foreground">
              Send raw notes to Grok, paste cleaned CSV back
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </header>

        <div className="grid md:grid-cols-2 flex-1 min-h-0">
          {/* LEFT: prompt */}
          <section className="border-r flex flex-col min-h-0">
            <div className="px-5 py-3 border-b flex items-center justify-between shrink-0">
              <div>
                <div className="text-sm font-medium">1. Copy this prompt</div>
                <div className="text-xs text-muted-foreground">
                  Paste it into Grok. The raw pin data is included.
                </div>
              </div>
              <button
                onClick={onCopyPrompt}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    Copy prompt
                  </>
                )}
              </button>
            </div>
            {audioClips.length > 0 && (
              <div className="border-b px-5 py-3 shrink-0 bg-canvas/40">
                <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5">
                  <Mic className="size-3.5 text-primary" />
                  {audioClips.length} voice clip{audioClips.length === 1 ? "" : "s"} — attach to Grok with the prompt
                </div>
                <div className="text-[11px] text-muted-foreground mb-2">
                  Download each clip and drag it into the Grok chat alongside the pasted prompt. Grok will transcribe and return them as an "Interview Notes" block.
                </div>
                <ul className="space-y-1 max-h-32 overflow-auto thin-scroll">
                  {audioClips.map((clip) => {
                    const url = objectUrls[clip.filename];
                    return (
                      <li key={clip.filename} className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono truncate">{clip.filename}</span>
                        {url ? (
                          <a
                            href={url}
                            download={clip.filename}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border hover:bg-accent shrink-0"
                          >
                            <Download className="size-3" />
                            Download
                          </a>
                        ) : (
                          <span className="text-muted-foreground">unavailable</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <textarea
              readOnly
              value={promptText}
              className="flex-1 w-full font-mono text-[11px] leading-snug p-4 bg-canvas/60 resize-none focus:outline-none"
            />
          </section>


          {/* RIGHT: paste */}
          <section className="flex flex-col min-h-0">
            <div className="px-5 py-3 border-b shrink-0">
              <div className="text-sm font-medium">2. Paste cleaned CSV from Grok</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                Columns: Pin, Room/Area, Description, Photos
                <label className="ml-2 text-primary hover:underline cursor-pointer">
                  or upload .csv
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onFile(f);
                    }}
                  />
                </label>
              </div>
            </div>
            <textarea
              value={csvText}
              onChange={(e) => onParse(e.target.value)}
              placeholder="Pin,Room/Area,Description,Photos&#10;1,Living room,Hairline crack at corner,&quot;1, 2, 3&quot;&#10;..."
              className="h-56 w-full font-mono text-xs leading-snug p-4 bg-canvas/60 resize-none border-b focus:outline-none"
            />

            <div className="flex-1 overflow-auto thin-scroll p-4 text-sm">
              {error && (
                <div className="flex items-start gap-2 text-destructive border border-destructive/30 bg-destructive/5 rounded-sm p-3 mb-3">
                  <AlertCircle className="size-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {preview && (
                <>
                  <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
                    <span>{preview.rows.length} rows parsed</span>
                    {preview.missingPins.length > 0 && (
                      <span className="text-amber-600">
                        {preview.missingPins.length} project pin(s) missing from CSV:{" "}
                        {preview.missingPins.slice(0, 8).join(", ")}
                        {preview.missingPins.length > 8 ? "…" : ""}
                      </span>
                    )}
                    {preview.unknownPins.length > 0 && (
                      <span className="text-amber-600">
                        {preview.unknownPins.length} CSV pin(s) unknown:{" "}
                        {preview.unknownPins.slice(0, 8).join(", ")}
                        {preview.unknownPins.length > 8 ? "…" : ""}
                      </span>
                    )}
                  </div>
                  <div className="border rounded-sm overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left px-2 py-1.5 font-medium w-12">Pin</th>
                          <th className="text-left px-2 py-1.5 font-medium w-32">Room/Area</th>
                          <th className="text-left px-2 py-1.5 font-medium">Description</th>
                          <th className="text-left px-2 py-1.5 font-medium w-24">Photos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-2 py-1.5 font-mono">{r.pin}</td>
                            <td className="px-2 py-1.5">{r.roomArea}</td>
                            <td className="px-2 py-1.5">{r.description}</td>
                            <td className="px-2 py-1.5 font-mono">{r.photos}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.interviewNotes && (
                    <div className="mt-3 border rounded-sm p-3 bg-canvas/40">
                      <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5">
                        <Mic className="size-3.5 text-primary" />
                        Interview Notes detected — will be added as a report section
                      </div>
                      <p className="text-xs whitespace-pre-wrap leading-relaxed text-muted-foreground line-clamp-[12]">
                        {preview.interviewNotes}
                      </p>
                    </div>
                  )}
                </>
              )}


              {!preview && !error && (
                <p className="text-xs text-muted-foreground italic">
                  Paste Grok's CSV above to preview. Nothing is saved until you apply.
                </p>
              )}
            </div>

            <div className="border-t px-5 py-3 flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={onClose}
                className="text-sm px-3 py-1.5 rounded-sm border hover:bg-accent"
              >
                Cancel
              </button>
              <button
                disabled={!preview || preview.rows.length === 0}
                onClick={onApply}
                className="text-sm px-3 py-1.5 rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply {preview ? `${preview.rows.length} rows` : ""}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
