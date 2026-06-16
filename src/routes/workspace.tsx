import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useReportStore } from "@/lib/store";
import { OutlinePane } from "@/components/report/OutlinePane";
import { CanvasPane } from "@/components/report/CanvasPane";
import { InspectorPane } from "@/components/report/InspectorPane";
import { WorkspaceHeader } from "@/components/report/WorkspaceHeader";

export const Route = createFileRoute("/workspace")({
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
  const project = useReportStore((s) => s.project);
  const hydrate = useReportStore((s) => s.hydrateFromDraft);

  useEffect(() => {
    if (!project) {
      const ok = hydrate();
      if (!ok) navigate({ to: "/" });
    }
  }, [project, hydrate, navigate]);

  if (!project) return null;

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
