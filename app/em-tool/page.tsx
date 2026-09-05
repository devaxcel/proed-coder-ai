"use client";

import { useState } from "react";
import { AIOutputDisclaimer } from "@/lib/disclaimers";

const BRAND = "#14457B";
const CARD = "#E7ECF4";
const AMBER = "#B45309";
const AMBER_LIGHT = "#FEF3C7";

type Basis = "time" | "mdm" | null;
type PatientType = "new" | "established" | null;

// Placeholder time bands — 4 bands per patient type, matching the real
// system's SHAPE (4 tiers each for new/established), but using generic
// labels instead of AMA's actual minute thresholds and code numbers.
const TIME_BANDS_ESTABLISHED = ["Band A — shortest", "Band B", "Band C", "Band D — longest"];
const TIME_BANDS_NEW = ["Band A — shortest", "Band B", "Band C", "Band D — longest"];

// Placeholder MDM criteria — generic, everyday phrasing describing the
// KIND of clinical scenario at each level, deliberately NOT the real AMA
// table's specific wording. Preserves the real structure: each level has
// multiple individually-checkable criteria, not one button per level.
type CriteriaLevel = { level: 2 | 3 | 4 | 5; label: string; items: string[] };

const PROBLEM_CRITERIA: CriteriaLevel[] = [
  { level: 2, label: "Level 2", items: ["Single minor, self-resolving issue"] },
  { level: 3, label: "Level 3", items: ["Multiple minor issues", "One ongoing stable condition", "One straightforward acute issue"] },
  { level: 4, label: "Level 4", items: ["One ongoing condition with a flare-up or side effect", "Two or more ongoing stable conditions", "A new problem with an uncertain outlook", "An acute issue with wider symptoms"] },
  { level: 5, label: "Level 5", items: ["An ongoing condition with a severe flare-up", "An issue that could threaten life or a body function"] },
];

const DATA_CRITERIA: CriteriaLevel[] = [
  { level: 2, label: "Level 2", items: ["Little to no outside data reviewed"] },
  { level: 3, label: "Level 3", items: ["Reviewed notes from an outside source", "Ordered a lab or imaging test", "Reviewed results of a lab or imaging test", "Needed input from someone other than the patient (e.g. a family member)"] },
  { level: 4, label: "Level 4", items: ["Independently reviewed an outside test result yourself", "Discussed the case directly with another treating clinician", "Combination of several data points above"] },
  { level: 5, label: "Level 5", items: ["Extensive review across multiple outside sources and direct discussion with another clinician"] },
];

const RISK_CRITERIA: CriteriaLevel[] = [
  { level: 2, label: "Level 2", items: ["Minimal risk from any testing or treatment"] },
  { level: 3, label: "Level 3", items: ["Low risk from testing or treatment planned"] },
  { level: 4, label: "Level 4", items: ["Starting or adjusting a prescription that needs monitoring", "Considering a minor procedure with some patient risk factors", "Care affected by social/economic factors"] },
  { level: 5, label: "Level 5", items: ["A drug therapy that needs close monitoring for toxicity", "Considering a major procedure or hospitalization", "A decision to limit or stop life-sustaining treatment"] },
];

function overallFromChecked(checked: Record<string, boolean>, criteria: CriteriaLevel[]): number {
  // Highest level with at least one checked criterion.
  let highest = 0;
  for (const group of criteria) {
    const anyChecked = group.items.some((_, i) => checked[`${group.level}-${i}`]);
    if (anyChecked && group.level > highest) highest = group.level;
  }
  return highest;
}

function CriteriaGroup({
  title,
  criteria,
  checked,
  onToggle,
}: {
  title: string;
  criteria: CriteriaLevel[];
  checked: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <div>
      <div className="text-xs font-semibold mb-2" style={{ color: BRAND }}>{title}</div>
      <div className="space-y-3">
        {criteria.map((group) => (
          <div key={group.level} className="rounded-md border border-slate-200 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{group.label}</div>
            <div className="space-y-1.5">
              {group.items.map((item, i) => {
                const key = `${group.level}-${i}`;
                return (
                  <label key={key} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!checked[key]}
                      onChange={() => onToggle(key)}
                      className="mt-0.5 h-3.5 w-3.5"
                      style={{ accentColor: BRAND }}
                    />
                    <span className="text-xs text-slate-700">{item}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EMToolPage() {
  const [basis, setBasis] = useState<Basis>(null);
  const [patientType, setPatientType] = useState<PatientType>(null);
  const [selectedBand, setSelectedBand] = useState<string | null>(null);

  const [problemChecked, setProblemChecked] = useState<Record<string, boolean>>({});
  const [dataChecked, setDataChecked] = useState<Record<string, boolean>>({});
  const [riskChecked, setRiskChecked] = useState<Record<string, boolean>>({});

  const problemLevel = overallFromChecked(problemChecked, PROBLEM_CRITERIA);
  const dataLevel = overallFromChecked(dataChecked, DATA_CRITERIA);
  const riskLevel = overallFromChecked(riskChecked, RISK_CRITERIA);

  const mdmOverall = (() => {
    if (!problemLevel || !dataLevel || !riskLevel) return null;
    const levels = [problemLevel, dataLevel, riskLevel].sort((a, b) => a - b);
    const middle = levels[1]; // 2-of-3 methodology, same as before
    if (middle >= 5) return "High";
    if (middle === 4) return "Moderate";
    if (middle === 3) return "Low";
    return "Straightforward";
  })();

  const bands = patientType === "new" ? TIME_BANDS_NEW : TIME_BANDS_ESTABLISHED;

  function toggle(setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, key: string) {
    setter((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function reset() {
    setBasis(null);
    setPatientType(null);
    setSelectedBand(null);
    setProblemChecked({});
    setDataChecked({});
    setRiskChecked({});
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h1 className="text-xl font-bold text-white">E/M Level Helper</h1>
          <p className="mt-1 text-sm text-white/85">
            Walks through the time-based vs. MDM-based decision and estimates a general complexity level.
          </p>
        </div>
      </section>

      <div className="rounded-md border border-amber-300 p-4 text-sm" style={{ backgroundColor: AMBER_LIGHT, color: AMBER }}>
        <b>⚠️ Placeholder mode — pending AMA CPT license.</b> Time bands and MDM criteria below use generic placeholder wording, not AMA's official CPT table language, and this tool never displays a specific CPT code number. Once ProEd secures the AMA license, this will show the actual time thresholds, official criteria wording, and the real corresponding code.
      </div>

      <AIOutputDisclaimer />

      {/* Step 1: New vs Established */}
      <div className="rounded-lg border p-5" style={{ borderColor: BRAND }}>
        <div className="text-sm font-semibold mb-3" style={{ color: BRAND }}>1. Patient Type</div>
        <div className="flex gap-2">
          {(["new", "established"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setPatientType(t); setSelectedBand(null); }}
              className="rounded-md px-4 py-2 text-sm font-medium border capitalize"
              style={{
                borderColor: BRAND,
                backgroundColor: patientType === t ? BRAND : "white",
                color: patientType === t ? "white" : BRAND,
              }}
            >
              {t} patient
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Time vs MDM */}
      <div className="rounded-lg border p-5" style={{ borderColor: BRAND }}>
        <div className="text-sm font-semibold mb-3" style={{ color: BRAND }}>2. Basis for Level Selection</div>
        <div className="flex gap-2">
          <button
            onClick={() => setBasis("time")}
            className="rounded-md px-4 py-2 text-sm font-medium border"
            style={{ borderColor: BRAND, backgroundColor: basis === "time" ? BRAND : "white", color: basis === "time" ? "white" : BRAND }}
          >
            Time-based
          </button>
          <button
            onClick={() => setBasis("mdm")}
            className="rounded-md px-4 py-2 text-sm font-medium border"
            style={{ borderColor: BRAND, backgroundColor: basis === "mdm" ? BRAND : "white", color: basis === "mdm" ? "white" : BRAND }}
          >
            MDM-based
          </button>
        </div>

        {basis === "time" && (
          <div className="mt-4">
            <label className="text-xs font-medium text-slate-600 block mb-2">
              Select the time band that covers the total time spent on the date of the encounter
              {!patientType && <span className="text-amber-600"> — select a patient type above first</span>}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {bands.map((band) => (
                <button
                  key={band}
                  type="button"
                  disabled={!patientType}
                  onClick={() => setSelectedBand(band)}
                  className="rounded-md border px-3 py-2 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    borderColor: BRAND,
                    backgroundColor: selectedBand === band ? BRAND : "white",
                    color: selectedBand === band ? "white" : BRAND,
                  }}
                >
                  {band}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Countable time includes: reviewing history, exam, counseling, ordering tests, documenting, and care coordination performed by the billing provider on the date of the encounter.
            </p>
          </div>
        )}
      </div>

      {/* Step 3: MDM elements — individually clickable criteria per level */}
      {basis === "mdm" && (
        <div className="rounded-lg border p-5 space-y-5" style={{ borderColor: BRAND }}>
          <div className="text-sm font-semibold" style={{ color: BRAND }}>3. Medical Decision Making — Select All That Apply</div>
          <p className="text-xs text-slate-500 -mt-3">
            Check every item that reflects this encounter. The highest level with at least one checked item is used for that category.
          </p>
          <CriteriaGroup title="Number & Complexity of Problems Addressed" criteria={PROBLEM_CRITERIA} checked={problemChecked} onToggle={(k) => toggle(setProblemChecked, k)} />
          <CriteriaGroup title="Amount/Complexity of Data Reviewed" criteria={DATA_CRITERIA} checked={dataChecked} onToggle={(k) => toggle(setDataChecked, k)} />
          <CriteriaGroup title="Risk of Complications / Management" criteria={RISK_CRITERIA} checked={riskChecked} onToggle={(k) => toggle(setRiskChecked, k)} />

          {(problemLevel > 0 || dataLevel > 0 || riskLevel > 0) && (
            <div className="rounded-md p-3 text-xs flex flex-wrap gap-4" style={{ backgroundColor: CARD }}>
              <span><b>Problems:</b> {problemLevel ? `Level ${problemLevel}` : "—"}</span>
              <span><b>Data:</b> {dataLevel ? `Level ${dataLevel}` : "—"}</span>
              <span><b>Risk:</b> {riskLevel ? `Level ${riskLevel}` : "—"}</span>
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {((basis === "time" && selectedBand) || (basis === "mdm" && mdmOverall)) && (
        <div className="rounded-lg border p-5" style={{ borderColor: BRAND, backgroundColor: CARD }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: BRAND }}>
            Result — General Complexity
          </div>
          {basis === "time" ? (
            <div className="text-lg font-bold text-slate-900">
              Time-based visit — {selectedBand}
            </div>
          ) : (
            <div className="text-lg font-bold text-slate-900">{mdmOverall} complexity (MDM-based)</div>
          )}
          <p className="mt-2 text-sm text-slate-600">
            Patient type: <b className="capitalize">{patientType ?? "not selected"}</b>
          </p>
          <div className="mt-3 rounded-md bg-white border border-slate-200 p-3 text-xs text-slate-500 italic">
            Specific CPT code number will appear here once ProEd&apos;s AMA CPT license is active and real code data is integrated.
          </div>
        </div>
      )}

      <button onClick={reset} className="text-xs text-slate-500 hover:underline">
        Reset all selections
      </button>
    </div>
  );
}
