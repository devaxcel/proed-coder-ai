"use client";

import { useState } from "react";
import { AWV_MEASURE_SECTIONS, type MeasureItem, lookupBmiDxCodes, bmiToMipsIndex, systolicToIndex, diastolicToIndex } from "@/lib/awv-measures-data";
import { THEME } from "@/lib/theme";

const TEAL = THEME.primary;
const TEAL_LIGHT = THEME.primaryLight;
const TEAL_DARK = THEME.primary;
const AMBER = "#B45309";
const AMBER_LIGHT = "#FEF3C7";

// Selection state is keyed by a fully-unique per-rendered-item id, so
// clicking a code in one section never affects the same code number
// appearing in a different section (e.g. 4016F shows up in both Pain
// Assessments and Osteoarthritis, but they're tracked independently).
type SelectionKey = string;
function itemKey(sectionKey: string, groupIdx: number, itemIdx: number): SelectionKey {
  return `${sectionKey}::${groupIdx}::${itemIdx}`;
}

function CodeChip({
  item,
  selected,
  onClick,
}: {
  item: MeasureItem;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={item.note}
      className="w-full text-left rounded-md border px-3 py-2 text-xs transition"
      style={{
        borderColor: selected ? TEAL : "#E2E8F0",
        backgroundColor: selected ? TEAL : "white",
        color: selected ? "white" : "#1F2937",
      }}
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-bold">{item.code}</span>
        <span
          className="rounded px-1 py-0.5 text-[9px] font-medium"
          style={{
            backgroundColor: selected ? "rgba(255,255,255,0.2)" : TEAL_LIGHT,
            color: selected ? "white" : TEAL_DARK,
          }}
        >
          {item.status}
        </span>
        {item.dx && (
          <span className="text-[10px] opacity-80">{item.dx}</span>
        )}
      </div>
      <div className={selected ? "text-white/90 mt-0.5" : "text-slate-600 mt-0.5"}>
        {item.description}
      </div>
    </button>
  );
}

export default function AwvMeasuresPanel() {
  const [selected, setSelected] = useState<Record<SelectionKey, boolean>>({});
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [patientName, setPatientName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [dos, setDos] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  // BMI numeric input — auto-computes Z68.x/E66.x diagnosis codes AND
  // auto-selects the matching MIPS chip (group index 1 in the "bmi"
  // section), per Lupita's request to merge the old BMI lookup in here.
  const [bmiInput, setBmiInput] = useState("");
  const bmiValue = parseFloat(bmiInput);
  const bmiDxResult = !isNaN(bmiValue) && bmiValue > 0 ? lookupBmiDxCodes(bmiValue) : null;

  function onBmiInputChange(value: string) {
    setBmiInput(value);
    const n = parseFloat(value);
    const idx = bmiToMipsIndex(n);
    if (idx !== null) {
      selectSingle("bmi", 1, idx, 4);
    }
  }

  // Blood Pressure numeric inputs — same auto-select pattern, for the
  // Systolic (group 0) and Diastolic (group 1) groups independently.
  const [systolicInput, setSystolicInput] = useState("");
  const [diastolicInput, setDiastolicInput] = useState("");

  function onSystolicChange(value: string) {
    setSystolicInput(value);
    const idx = systolicToIndex(parseFloat(value));
    if (idx !== null) selectSingle("blood-pressure", 0, idx, 3);
  }
  function onDiastolicChange(value: string) {
    setDiastolicInput(value);
    const idx = diastolicToIndex(parseFloat(value));
    if (idx !== null) selectSingle("blood-pressure", 1, idx, 3);
  }

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectSingle(sectionKey: string, groupIdx: number, itemIdx: number, groupSize: number) {
    setSelected((prev) => {
      const next = { ...prev };
      // Clear every other item in this same single-select group first —
      // radio-button behavior, only one choice per group.
      for (let i = 0; i < groupSize; i++) {
        delete next[itemKey(sectionKey, groupIdx, i)];
      }
      next[itemKey(sectionKey, groupIdx, itemIdx)] = true;
      return next;
    });
  }

  function toggleChecklist(sectionKey: string, groupIdx: number, itemIdx: number) {
    const key = itemKey(sectionKey, groupIdx, itemIdx);
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const filteredSections = query.trim()
    ? AWV_MEASURE_SECTIONS.filter((s) => {
        const q = query.toLowerCase();
        if (s.title.toLowerCase().includes(q)) return true;
        return s.groups.some((g) => g.items.some((i) => i.code.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)));
      })
    : AWV_MEASURE_SECTIONS;

  // The actual list of everything currently selected, across every
  // section — this is what "clicking a code" is FOR: it builds this
  // list, which you can review below and export as a document.
  type SelectedListItem = { sectionTitle: string; code: string; description: string; dx: string };
  const selectedList: SelectedListItem[] = [];
  for (const section of AWV_MEASURE_SECTIONS) {
    section.groups.forEach((group, gi) => {
      group.items.forEach((item, ii) => {
        if (selected[itemKey(section.key, gi, ii)]) {
          selectedList.push({ sectionTitle: section.title, code: item.code, description: item.description, dx: item.dx ?? "" });
        }
      });
    });
  }
  const totalSelected = selectedList.length;

  // Full reference — every code in every section, with a selected flag,
  // for the "export the whole page" request distinct from "export just
  // what I clicked."
  type FullRefItem = SelectedListItem & { isSelected: boolean };
  const fullReferenceList: FullRefItem[] = [];
  for (const section of AWV_MEASURE_SECTIONS) {
    section.groups.forEach((group, gi) => {
      group.items.forEach((item, ii) => {
        fullReferenceList.push({
          sectionTitle: section.title,
          code: item.code,
          description: item.description,
          dx: item.dx ?? "",
          isSelected: !!selected[itemKey(section.key, gi, ii)],
        });
      });
    });
  }

  async function onExportFullReference() {
    setExporting(true);
    setExportErr(null);
    try {
      const r = await fetch("/api/annual-wellness/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientName, accountNumber, dos, items: fullReferenceList, fullReference: true }),
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        setExportErr(json.error ?? "Export failed");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ProEdCS-AWV-Full-Reference-${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setExportErr(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function onExport() {
    if (totalSelected === 0) return;
    setExporting(true);
    setExportErr(null);
    try {
      const r = await fetch("/api/annual-wellness/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientName, accountNumber, dos, items: selectedList }),
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        setExportErr(json.error ?? "Export failed");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ProEdCS-AWV-Measures-${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setExportErr(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-bold" style={{ color: TEAL_DARK }}>
          Quality Measures — All {AWV_MEASURE_SECTIONS.length} Sections
        </h2>
        {totalSelected > 0 && (
          <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: TEAL }}>
            {totalSelected} code{totalSelected !== 1 ? "s" : ""} selected
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Click a code below to mark it as applicable for this visit — clicking builds the summary list at the bottom of this panel, which you can then export as a document.
      </p>

      {/* Patient context for the export — same pattern as MEAT HCC */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg border p-3" style={{ borderColor: TEAL_LIGHT, backgroundColor: TEAL_LIGHT }}>
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Patient Name</label>
          <input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Last, First" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Account Number</label>
          <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="MRN / Account #" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Date of Service</label>
          <input type="date" value={dos} onChange={(e) => setDos(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter sections by name or code…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />

      <button
        type="button"
        onClick={onExportFullReference}
        disabled={exporting}
        className="rounded-md px-4 py-2 text-xs font-medium border disabled:opacity-50"
        style={{ borderColor: TEAL, color: TEAL }}
      >
        {exporting ? "Generating…" : "⬇ Export Full Reference (All Codes, Every Section)"}
      </button>
      {exportErr && <p className="text-xs text-red-600">{exportErr}</p>}

      <div className="space-y-2">
        {filteredSections.map((section) => {
          const isOpen = openSections.has(section.key) || !!query.trim();
          const sectionSelectedCount = section.groups.reduce(
            (sum, g, gi) => sum + g.items.reduce((s2, _, ii) => s2 + (selected[itemKey(section.key, gi, ii)] ? 1 : 0), 0),
            0
          );
          return (
            <div key={section.key} className="rounded-lg border overflow-hidden" style={{ borderColor: TEAL }}>
              <button
                type="button"
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                style={{ backgroundColor: TEAL }}
              >
                <div>
                  <div className="text-sm font-semibold text-white">{section.title}</div>
                  {section.populationNote && <div className="text-[11px] text-white/75 mt-0.5">{section.populationNote}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {sectionSelectedCount > 0 && (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">{sectionSelectedCount}</span>
                  )}
                  <span className={`text-white transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                </div>
              </button>

              {isOpen && (
                <div className="p-4 space-y-3 bg-white">
                  {section.sectionNote && (
                    <div className="rounded-md border border-amber-300 p-2 text-xs" style={{ backgroundColor: AMBER_LIGHT, color: AMBER }}>
                      {section.sectionNote}
                    </div>
                  )}

                  {/* BMI numeric lookup — merged in from the old standalone
                      BMI section per Lupita's request. Entering a value
                      shows the Z68.x/E66.x diagnosis codes AND
                      auto-selects the matching MIPS chip below. */}
                  {section.key === "bmi" && (
                    <div className="rounded-md border p-3" style={{ borderColor: TEAL, backgroundColor: TEAL_LIGHT }}>
                      <label className="block text-xs font-bold mb-1" style={{ color: TEAL_DARK }}>Enter Patient BMI Value</label>
                      <input
                        type="number"
                        step="0.1"
                        value={bmiInput}
                        onChange={(e) => onBmiInputChange(e.target.value)}
                        placeholder="e.g., 30"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm w-32"
                      />
                      {bmiDxResult && (
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="rounded-md border border-slate-200 bg-white p-2">
                            <div className="text-[10px] font-semibold text-slate-500">BMI diagnosis code (Z68.x)</div>
                            {bmiDxResult.z ? (
                              <div className="text-sm"><b style={{ color: TEAL_DARK }}>{bmiDxResult.z.code}</b> — {bmiDxResult.z.category} ({bmiDxResult.z.label})</div>
                            ) : <div className="text-xs text-slate-400">Out of table range</div>}
                          </div>
                          <div className="rounded-md border border-slate-200 bg-white p-2">
                            <div className="text-[10px] font-semibold text-slate-500">Companion obesity code (E66.x), if clinically documented</div>
                            {bmiDxResult.e ? (
                              <div className="text-sm"><b>{bmiDxResult.e.code}</b> — {bmiDxResult.e.label}</div>
                            ) : <div className="text-xs text-slate-400">Not applicable at this BMI</div>}
                          </div>
                        </div>
                      )}
                      <p className="mt-2 text-[10px] text-slate-500">
                        Pair a Z-code with an E66.x code only when obesity is clinically documented by the provider — never assign E66.x from the BMI value alone.
                      </p>
                    </div>
                  )}

                  {/* Blood Pressure numeric lookup — same auto-select pattern */}
                  {section.key === "blood-pressure" && (
                    <div className="rounded-md border p-3 grid grid-cols-2 gap-3" style={{ borderColor: TEAL, backgroundColor: TEAL_LIGHT }}>
                      <div>
                        <label className="block text-xs font-bold mb-1" style={{ color: TEAL_DARK }}>Systolic (mmHg)</label>
                        <input
                          type="number"
                          value={systolicInput}
                          onChange={(e) => onSystolicChange(e.target.value)}
                          placeholder="e.g., 128"
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1" style={{ color: TEAL_DARK }}>Diastolic (mmHg)</label>
                        <input
                          type="number"
                          value={diastolicInput}
                          onChange={(e) => onDiastolicChange(e.target.value)}
                          placeholder="e.g., 82"
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm w-full"
                        />
                      </div>
                    </div>
                  )}

                  {section.groups.map((group, gi) => (
                    <div key={gi}>
                      {group.type === "single-select" && group.label && (
                        <div
                          className={
                            section.key === "blood-pressure"
                              ? "text-xs font-bold uppercase tracking-wide mb-1.5"
                              : "text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5"
                          }
                          style={section.key === "blood-pressure" ? { color: TEAL_DARK } : undefined}
                        >
                          {group.label} — select one
                        </div>
                      )}
                      <div className={group.type === "single-select" ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "grid grid-cols-1 sm:grid-cols-2 gap-2"}>
                        {group.items.map((item, ii) => {
                          const key = itemKey(section.key, gi, ii);
                          const isSelected = !!selected[key];
                          return (
                            <CodeChip
                              key={key}
                              item={item}
                              selected={isSelected}
                              onClick={() =>
                                group.type === "single-select"
                                  ? selectSingle(section.key, gi, ii, group.items.length)
                                  : toggleChecklist(section.key, gi, ii)
                              }
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filteredSections.length === 0 && (
          <p className="text-sm text-slate-500">No sections match &ldquo;{query}&rdquo;.</p>
        )}
      </div>

      {/* Live summary of everything selected — this is the actual
          "output" of clicking codes, plus the export action. */}
      {totalSelected > 0 && (
        <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: TEAL }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold" style={{ color: TEAL_DARK }}>
              Selected Codes Summary ({totalSelected})
            </h3>
            <button
              type="button"
              onClick={onExport}
              disabled={exporting}
              className="rounded-md px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: TEAL }}
            >
              {exporting ? "Generating…" : "⬇ Export as DOCX"}
            </button>
          </div>
          {exportErr && <p className="text-xs text-red-600">{exportErr}</p>}
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {selectedList.map((item, i) => (
              <div key={i} className="rounded-md p-2 text-xs" style={{ backgroundColor: TEAL_LIGHT }}>
                <span className="font-semibold" style={{ color: TEAL_DARK }}>{item.code}</span>
                <span className="text-slate-500"> — {item.sectionTitle} — </span>
                <span className="text-slate-700">{item.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

