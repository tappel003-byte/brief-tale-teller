import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useReportStore } from "@/lib/store";
import { OutlinePane } from "@/components/report/OutlinePane";
import { CanvasPane } from "@/components/report/CanvasPane";
import { InspectorPane } from "@/components/report/InspectorPane";
import { WorkspaceHeader } from "@/components/report/WorkspaceHeader";
import { Loader2 } from "lucide-react";

const SearchSchema = z.object({
  job: z.string().optional(),
});

export const Route = createFileRoute("/workspace")({
  validateSearch: (s) => SearchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Report Builder — Workspace" },
      {
        name: "description",
        content: "Edit, reorder, and polish your distress-survey report.",
      },
    ],
  }),
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const project = useReportStore((s) => s.project);
  const loadJobById = useReportStore((s) => s.loadJobById);
  const hydrate = useReportStore((s) => s.hydrateFromDraft);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      // Already loaded the right job?
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
      // No job id and nothing loaded — try legacy draft, else go home.
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

  return (
    <div className="h-screen flex flex-col bg-background">
      <WorkspaceHeader />
      <div className="flex-1 grid grid-cols-[260px_minmax(0,1fr)_340px] min-h-0">
        <aside className="border-r bg-panel overflow-y-auto thin-scroll">
          <OutlinePane />
        </aside>
        <main className="overflow-y-auto thin-scroll workspace-gutter">
          <CanvasPane />
        </main>
        <aside className="border-l bg-panel overflow-y-auto thin-scroll">
          <InspectorPane />
        </aside>
      </div>
    </div>
  );
}
