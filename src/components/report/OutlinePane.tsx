import { useReportStore } from "@/lib/store";
import { ChevronDown, ChevronUp, FileText, ImagePlus, MapPin, Plus, Trash2, Type } from "lucide-react";
import type { ReportSection } from "@/lib/types";

export function OutlinePane() {
  const project = useReportStore((s) => s.project)!;
  const moveSection = useReportStore((s) => s.moveSection);
  const removeSection = useReportStore((s) => s.removeSection);
  const addSection = useReportStore((s) => s.addSection);

  const scrollTo = (id: string) => {
    const el = document.getElementById(`sec-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="p-3 space-y-1">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-2 pt-1 pb-2">
        Outline
      </p>
      {project.sections.map((sec, i) => (
        <OutlineItem
          key={sec.id}
          section={sec}
          first={i === 0}
          last={i === project.sections.length - 1}
          onClick={() => scrollTo(sec.id)}
          onUp={() => moveSection(sec.id, -1)}
          onDown={() => moveSection(sec.id, 1)}
          onDelete={() => {
            if (sec.kind === "cover") return;
            if (confirm(`Remove "${sectionLabel(sec)}"?`)) removeSection(sec.id);
          }}
        />
      ))}

      <div className="pt-3 border-t mt-3 space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-2 pb-1">
          Insert section
        </p>
        <AddBtn
          icon={<Type className="size-3.5" />}
          label="Free text"
          onClick={() =>
            addSection({
              id: `sec-${crypto.randomUUID()}`,
              kind: "freetext",
              title: "Untitled",
              body: "",
            })
          }
        />
        <AddBtn
          icon={<MapPin className="size-3.5" />}
          label="Findings group"
          onClick={() =>
            addSection({
              id: `sec-${crypto.randomUUID()}`,
              kind: "findings",
              title: "Findings",
              pinIds: [],
            })
          }
        />
        <AddBtn
          icon={<ImagePlus className="size-3.5" />}
          label="Page break"
          onClick={() =>
            addSection({
              id: `sec-${crypto.randomUUID()}`,
              kind: "page-break",
            })
          }
        />
      </div>
    </div>
  );
}

function OutlineItem({
  section,
  first,
  last,
  onClick,
  onUp,
  onDown,
  onDelete,
}: {
  section: ReportSection;
  first: boolean;
  last: boolean;
  onClick: () => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-1 rounded-sm hover:bg-accent/60 transition-colors">
      <button
        onClick={onClick}
        className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left text-sm min-w-0"
      >
        <FileText className="size-3.5 text-muted-foreground shrink-0" />
        <span className="truncate">{sectionLabel(section)}</span>
      </button>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center pr-1">
        <button
          disabled={first}
          onClick={onUp}
          className="size-5 grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronUp className="size-3" />
        </button>
        <button
          disabled={last}
          onClick={onDown}
          className="size-5 grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronDown className="size-3" />
        </button>
        {section.kind !== "cover" && (
          <button
            onClick={onDelete}
            className="size-5 grid place-items-center text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function AddBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
    >
      <Plus className="size-3" />
      {icon}
      <span>{label}</span>
    </button>
  );
}

function sectionLabel(sec: ReportSection): string {
  if (sec.kind === "cover") return sec.title || "Cover";
  if (sec.kind === "freetext") return sec.title || "Untitled section";
  if (sec.kind === "findings") return sec.title || "Findings";
  return "— page break —";
}
