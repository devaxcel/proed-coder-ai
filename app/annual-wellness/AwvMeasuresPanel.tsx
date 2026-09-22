"use client";

import { useState } from "react";
import { AWV_MEASURE_SECTIONS, type MeasureItem } from "@/lib/awv-measures-data";

const TEAL = "#14457B";
const TEAL_LIGHT = "#E7ECF4";
const TEAL_DARK = "#14457B";
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

  const totalSelected = Object.values(selected).filter(Boolean).length;

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

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter sections by name or code…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />

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
                  {section.groups.map((group, gi) => (
                    <div key={gi}>
                      {group.type === "single-select" && group.label && (
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{group.label} — select one</div>
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
    </div>
  );
}
