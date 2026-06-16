import { useReportStore } from "@/lib/store";
import type {
  ReportSection,
  CoverSection,
  FreeTextSection,
  FindingsSection,
  Pin,
} from "@/lib/types";
import { Editable } from "./Editable";

export function CanvasPane() {
  const project = useReportStore((s) => s.project)!;

  return (
    <div className="py-8 px-4 md:px-10">
      <article
        id="report-canvas-root"
        className="report-canvas mx-auto max-w-[850px] bg-canvas border border-rule px-12 py-14"
        style={{ boxShadow: "var(--shadow-canvas)" }}
      >
        {project.sections.map((sec) => (
          <SectionRenderer key={sec.id} section={sec} />
        ))}
      </article>
    </div>
  );
}

function SectionRenderer({ section }: { section: ReportSection }) {
  return (
    <section id={`sec-${section.id}`} className="scroll-mt-16">
      {section.kind === "cover" && <CoverRenderer section={section} />}
      {section.kind === "freetext" && <FreeTextRenderer section={section} />}
      {section.kind === "findings" && <FindingsRenderer section={section} />}
      {section.kind === "page-break" && (
        <div
          className="my-8 border-t-2 border-dashed border-rule text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground py-2"
          data-editor-only
        >
          page break
        </div>
      )}
    </section>
  );
}

function CoverRenderer({ section }: { section: CoverSection }) {
  const updateSection = useReportStore((s) => s.updateSection);
  const objectUrls = useReportStore((s) => s.objectUrls);
  const planUrl = section.planFilename
    ? objectUrls[section.planFilename]
    : undefined;
  const isPdf = section.planFilename?.toLowerCase().endsWith(".pdf");

  return (
    <header className="mb-10">
      <p className="meta text-[10px] font-mono uppercase tracking-widest text-ink-soft mb-3">
        Distress Survey · Report
      </p>
      <h1>
        <Editable
          value={section.title}
          placeholder="Report title"
          onChange={(v) => updateSection(section.id, { title: v })}
        />
      </h1>
      <p className="meta text-sm text-ink-soft mt-1">
        <Editable
          value={section.address}
          placeholder="Site address"
          onChange={(v) => updateSection(section.id, { address: v })}
        />
      </p>
      <div className="meta flex gap-6 text-xs text-ink-soft mt-3 font-sans">
        <span>
          Date:{" "}
          <Editable
            inline
            value={section.date}
            placeholder="YYYY-MM-DD"
            onChange={(v) => updateSection(section.id, { date: v })}
          />
        </span>
        <span>
          Engineer:{" "}
          <Editable
            inline
            value={section.engineer}
            placeholder="Name"
            onChange={(v) => updateSection(section.id, { engineer: v })}
          />
        </span>
      </div>

      {planUrl && !isPdf && (
        <figure className="mt-6 border border-rule">
          <img
            src={planUrl}
            alt="Site plan with pinned distress locations"
            className="w-full h-auto block"
          />
          <figcaption className="text-[10px] font-sans text-ink-soft py-1.5 px-2 border-t border-rule">
            Site plan with pin locations
          </figcaption>
        </figure>
      )}
      {planUrl && isPdf && (
        <p className="meta text-xs text-ink-soft mt-4 font-mono">
          Plan attached: {section.planFilename} (PDF — view in saved project)
        </p>
      )}
    </header>
  );
}

function FreeTextRenderer({ section }: { section: FreeTextSection }) {
  const updateSection = useReportStore((s) => s.updateSection);
  return (
    <div className="mb-6">
      <h2>
        <Editable
          value={section.title}
          placeholder="Section title"
          onChange={(v) => updateSection(section.id, { title: v })}
        />
      </h2>
      <Editable
        multiline
        value={section.body}
        placeholder="Write or paste content for this section…"
        onChange={(v) => updateSection(section.id, { body: v })}
      />
    </div>
  );
}

function FindingsRenderer({ section }: { section: FindingsSection }) {
  const project = useReportStore((s) => s.project)!;
  const updateSection = useReportStore((s) => s.updateSection);
  const pins = section.pinIds
    .map((id) => project.pins[id])
    .filter(Boolean) as Pin[];

  return (
    <div className="mb-6">
      <h2>
        <Editable
          value={section.title}
          placeholder="Findings"
          onChange={(v) => updateSection(section.id, { title: v })}
        />
      </h2>
      {pins.length === 0 && (
        <p className="text-sm text-ink-soft italic" data-editor-only>
          No findings in this group. Findings are auto-generated from the pins
          in your ZIP — re-import to refresh.
        </p>
      )}
      {pins.map((pin) => (
        <FindingRow key={pin.id} pin={pin} sectionId={section.id} />
      ))}
    </div>
  );
}

function FindingRow({ pin, sectionId }: { pin: Pin; sectionId: string }) {
  const selectPin = useReportStore((s) => s.selectPin);
  const selectedPinId = useReportStore((s) => s.selectedPinId);
  const updatePin = useReportStore((s) => s.updatePin);
  const setCleaned = useReportStore((s) => s.setCleanedDescription);
  const movePin = useReportStore((s) => s.movePinInFindings);
  const objectUrls = useReportStore((s) => s.objectUrls);

  const heading =
    pin.headingOverride ??
    `Location ${pin.location}${pin.type ? ` — ${pin.type}` : ""}`;
  const isSelected = selectedPinId === pin.id;

  return (
    <div
      onClick={() => selectPin(pin.id)}
      className={
        "relative group my-5 rounded-sm transition-colors " +
        (isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-canvas" : "")
      }
    >
      <div
        className="absolute -left-8 top-1 hidden md:flex flex-col gap-0.5 opacity-0 group-hover:opacity-100"
        data-editor-only
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            movePin(sectionId, pin.id, -1);
          }}
          className="size-5 grid place-items-center rounded-sm bg-panel border text-muted-foreground hover:text-foreground"
          title="Move up"
        >
          ↑
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            movePin(sectionId, pin.id, 1);
          }}
          className="size-5 grid place-items-center rounded-sm bg-panel border text-muted-foreground hover:text-foreground"
          title="Move down"
        >
          ↓
        </button>
      </div>

      <h3>
        <Editable
          value={heading}
          placeholder="Finding heading"
          onChange={(v) => updatePin(pin.id, { headingOverride: v })}
        />
      </h3>
      <Editable
        multiline
        value={pin.cleanedDescription}
        placeholder="Cleaned description — click the inspector to run AI cleanup."
        onChange={(v) => setCleaned(pin.id, v, true)}
      />
      {pin.photos.length > 0 && (
        <table className="photo-table">
          <tbody>
            {chunk(pin.photos, 3).map((row, ri) => (
              <tr key={ri}>
                {row.map((p) => {
                  const url = objectUrls[p.filename];
                  return (
                    <td key={p.filename}>
                      {url ? (
                        <img
                          src={url}
                          alt={p.caption ?? `Photo ${p.n}`}
                          loading="lazy"
                        />
                      ) : (
                        <div className="aspect-[4/3] bg-muted grid place-items-center text-[10px] text-muted-foreground">
                          {p.filename}
                        </div>
                      )}
                      <div>{p.caption ?? `Photo ${p.n}`}</div>
                    </td>
                  );
                })}
                {row.length < 3 &&
                  Array.from({ length: 3 - row.length }).map((_, i) => (
                    <td key={`empty-${i}`} style={{ border: "none" }} />
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
