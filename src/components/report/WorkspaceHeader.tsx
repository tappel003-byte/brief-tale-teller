import { useState } from "react";
import { Download, Home, Save, Sparkles, CheckCircle2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useReportStore } from "@/lib/store";
import { downloadReportJson } from "@/lib/project-io";
import { copyCanvasToClipboard } from "@/lib/copy-canvas";
import { toast } from "sonner";
import { GrokDialog } from "./GrokDialog";

export function WorkspaceHeader() {
  const navigate = useNavigate();
  const project = useReportStore((s) => s.project);
  const closeProject = useReportStore((s) => s.closeProject);
  const [grokOpen, setGrokOpen] = useState(false);
  const updatedAt = project?.updatedAt;

  if (!project) return null;

  const onSave = () => {
    downloadReportJson(project);
    toast.success("Project saved", {
      description: "Downloaded as .report.json — keep it with the survey.",
    });
  };

  const onCopy = async () => {
    const ok = await copyCanvasToClipboard();
    if (ok) {
      toast.success("Copied", {
        description: "Paste into Word, Google Docs, or Pages.",
      });
    } else {
      toast.error("Copy failed", {
        description: "Try selecting the canvas manually and pressing Cmd+C.",
      });
    }
  };

  const onClose = () => {
    closeProject();
    navigate({ to: "/" });
  };

  return (
    <>
      <header className="h-12 border-b bg-panel flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            title="All jobs"
          >
            <Home className="size-4" />
          </button>
          <div className="size-6 rounded-sm bg-primary text-primary-foreground flex items-center justify-center font-mono text-[10px] font-semibold">
            RB
          </div>
          <span className="text-sm font-medium truncate">{project.name}</span>
          <span className="text-[11px] text-muted-foreground font-mono hidden md:inline">
            updated {fmt(updatedAt)}
          </span>
          {project.grokImported && (
            <span className="text-[11px] font-mono inline-flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="size-3" />
              Grok imported
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setGrokOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border border-input hover:bg-accent transition-colors"
          >
            <Sparkles className="size-3.5" />
            Grok round-trip
          </button>
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border border-input hover:bg-accent transition-colors"
          >
            <Download className="size-3.5 rotate-180" />
            Copy report
          </button>
          <button
            onClick={onSave}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Save className="size-3.5" />
            Save project
          </button>
        </div>
      </header>
      {grokOpen && <GrokDialog onClose={() => setGrokOpen(false)} />}
    </>
  );
}

function fmt(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
