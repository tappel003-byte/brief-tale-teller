import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FilePlus2, Trash2, FileArchive, CircleCheck, CircleAlert } from "lucide-react";
import { listJobs, deleteJob, type JobSummary } from "@/lib/jobs-db";
import { useReportStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Report Builder — Jobs" },
      {
        name: "description",
        content:
          "Your saved distress-survey jobs. Create new reports from Field Reporter ZIPs.",
      },
    ],
  }),
  component: JobsPage,
});

function JobsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const closeProject = useReportStore((s) => s.closeProject);

  useEffect(() => {
    // Clear any in-flight project so we get a clean slate when reopening.
    closeProject();
    void refresh();
  }, [closeProject]);

  async function refresh() {
    const list = await listJobs();
    setJobs(list);
  }

  async function onDelete(id: string) {
    await deleteJob(id);
    setConfirmId(null);
    void refresh();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-panel/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-sm bg-primary text-primary-foreground flex items-center justify-center font-mono text-[11px] font-semibold">
              RB
            </div>
            <span className="font-semibold tracking-tight">Report Builder</span>
            <span className="text-xs text-muted-foreground font-mono ml-2">
              v1 · local · no account
            </span>
          </div>
          <Link
            to="/new"
            className="inline-flex items-center gap-2 rounded-sm bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <FilePlus2 className="size-4" />
            New job
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Saved in this browser. Delete any job you no longer need.
          </p>
        </div>

        {jobs === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : jobs.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y border rounded-md bg-panel">
            {jobs.map((j) => (
              <li
                key={j.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-accent/40 transition-colors"
              >
                <FileArchive className="size-5 text-muted-foreground shrink-0" />
                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() =>
                    navigate({ to: "/workspace", search: { job: j.id } })
                  }
                >
                  <div className="font-medium truncate">{j.name}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    {j.pinCount} pins · {j.photoCount} photos · updated{" "}
                    {fmtDate(j.updatedAt)}
                  </div>
                </button>
                <span className="text-xs font-mono inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border">
                  {j.grokImported ? (
                    <>
                      <CircleCheck className="size-3 text-emerald-500" />
                      Grok imported
                    </>
                  ) : (
                    <>
                      <CircleAlert className="size-3 text-amber-500" />
                      Needs Grok CSV
                    </>
                  )}
                </span>
                {confirmId === j.id ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onDelete(j.id)}
                      className="text-xs px-2 py-1 rounded-sm bg-destructive text-destructive-foreground"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-xs px-2 py-1 rounded-sm border"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(j.id)}
                    className="text-muted-foreground hover:text-destructive p-1.5 rounded-sm"
                    title="Delete job"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="border-t bg-panel/40">
        <div className="max-w-5xl mx-auto px-6 py-4 text-xs text-muted-foreground flex items-center justify-between">
          <span>Report Builder — sibling tool to Field Reporter & Survey Sorter</span>
          <span className="font-mono">{new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-2 border-dashed border-rule rounded-md p-12 text-center bg-canvas/60">
      <FileArchive className="size-10 mx-auto text-muted-foreground mb-3" />
      <p className="font-medium mb-1">No saved jobs yet</p>
      <p className="text-sm text-muted-foreground mb-5">
        Start by dropping a Field Reporter ZIP.
      </p>
      <Link
        to="/new"
        className="inline-flex items-center gap-2 rounded-sm bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <FilePlus2 className="size-4" />
        New job
      </Link>
    </div>
  );
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
