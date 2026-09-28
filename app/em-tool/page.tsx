"use client";

import { useState } from "react";
import { AIOutputDisclaimer } from "@/lib/disclaimers";
import { THEME } from "@/lib/theme";

const BRAND = THEME.primary;
const CARD = THEME.primaryLight;
const AMBER = "#B45309";
const AMBER_LIGHT = "#FEF3C7";

type Basis = "time" | "mdm" | null;
type PatientType = "new" | "established" | null;

// Time-based E/M bands — total time on DOS must meet or exceed the listed
// minutes, per ProEd's reference chart (AMA CPT-licensed content).
type TimeBand = { code: string; minMinutes: number; label: string };

const TIME_BANDS_ESTABLISHED: TimeBand[] = [
  { code: "99212", minMinutes: 10, label: "10 min" },
  { code: "99213", minMinutes: 20, label: "20 min" },
  { code: "99214", minMinutes: 30, label: "30 min" },
  { code: "99215", minMinutes: 40, label: "40 min" },
];

const TIME_BANDS_NEW: TimeBand[] = [
  { code: "99202", minMinutes: 15, label: "15 min" },
  { code: "99203", minMinutes: 30, label: "30 min" },
  { code: "99204", minMinutes: 45, label: "45 min" },
  { code: "99205", minMinutes: 60, label: "60 min" },
];

// MDM criteria — AMA CPT-licensed content (2021 E/M guidelines table).
// All 4 levels (2-5) transcribed directly from ProEd's reference chart.
type CriteriaLevel = { level: 2 | 3 | 4 | 5; label: string; items: string[]; pending?: boolean };

const PROBLEM_CRITERIA: CriteriaLevel[] = [
  { level: 2, label: "Level 2 — Minimal", items: ["1 self-limited or minor problem"] },
  {
    level: 3,
    label: "Level 3 — Low",
    items: [
      "2 or more self-limited or minor problems",
      "1 stable, chronic illness",
      "1 acute, uncomplicated illness or injury",
      "1 stable, acute illness",
      "1 acute, uncomplicated illness or injury requiring hospital inpatient or observation level of care",
    ],
  },
  {
    level: 4,
    label: "Level 4 — Moderate",
    items: [
      "1 or more chronic illnesses with exacerbation, progression, or side effects of treatment",
      "2 or more stable, chronic illnesses",
      "1 undiagnosed new problem with uncertain prognosis",
      "1 acute illness with systemic symptoms",
      "1 acute, complicated injury",
    ],
  },
  {
    level: 5,
    label: "Level 5 — High",
    items: [
      "1 or more chronic illnesses with severe exacerbation, progression, or side effects of treatment",
      "1 acute or chronic illness or injury that poses a threat to life or bodily function",
    ],
  },
];

const DATA_CRITERIA: CriteriaLevel[] = [
  { level: 2, label: "Level 2 — Minimal", items: ["Minimal or none"] },
  {
    level: 3,
    label: "Level 3 — Low (1 category required)",
    items: [
      "Category 1 — Review of prior external note(s) from each unique source",
      "Category 1 — Ordering of each unique test",
      "Category 1 — Review of the result(s) of each unique test",
      "Category 2 — Assessment requiring an independent historian(s)",
    ],
  },
  {
    level: 4,
    label: "Level 4 — Moderate (1 category required)",
    items: [
      "Category 1 (any 3) — Review of prior external note(s) from each unique source",
      "Category 1 (any 3) — Ordering of each unique test",
      "Category 1 (any 3) — Review of the result(s) of each unique test",
      "Category 1 (any 3) — Assessment requiring an independent historian(s)",
      "Category 2 — Independent interpretation of a test performed by another MD/QHCP/appropriate source (not separately reported)",
      "Category 3 — Discussion of management or test interpretation with an external MD/QHCP/appropriate source (not separately reported)",
    ],
  },
  {
    level: 5,
    label: "Level 5 — High (2 categories required)",
    items: [
      "Category 1 (any 3) — Review of prior external note(s) from each unique source",
      "Category 1 (any 3) — Ordering of each unique test",
      "Category 1 (any 3) — Review of the result(s) of each unique test",
      "Category 1 (any 3) — Assessment requiring an independent historian(s)",
      "Category 2 — Independent interpretation of a test performed by another MD/QHCP/appropriate source (not separately reported)",
      "Category 3 — Discussion of management or test interpretation with an external MD/QHCP/appropriate source (not separately reported)",
    ],
  },
];

const RISK_CRITERIA: CriteriaLevel[] = [
  { level: 2, label: "Level 2 — Minimal", items: ["Minimal risk of morbidity from additional diagnostic testing or treatment"] },
  { level: 3, label: "Level 3 — Low", items: ["Low risk of morbidity from additional diagnostic testing or treatment"] },
  {
    level: 4,
    label: "Level 4 — Moderate",
    items: [
      "Prescription drug management",
      "Decision regarding minor surgery with identified patient or procedure risk factors",
      "Decision regarding elective major surgery without identified patient or procedure risk factors",
      "Diagnosis or treatment significantly limited by social determinants of health",
    ],
  },
  {
    level: 5,
    label: "Level 5 — High",
    items: [
      "Drug therapy requiring intensive monitoring for toxicity",
      "Decision regarding elective major surgery with identified patient or procedure risk factors",
      "Decision regarding emergency major surgery",
      "Decision regarding hospitalization or escalation of hospital-level care",
      "Decision not to resuscitate or to de-escalate care due to poor prognosis",
      "Decision regarding parenteral controlled substances",
    ],
  },
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
      <div className="text-sm font-bold mb-2" style={{ color: BRAND }}>{title}</div>
      <div className="space-y-3">
        {criteria.map((group) => (
          <div key={group.level} className="rounded-md border border-slate-200 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{group.label}</div>
            {group.pending && (
              <div className="text-xs italic text-amber-600">
                Pending — this row wasn&apos;t visible in the reference chart provided; add it once you have the full Level 5 wording.
              </div>
            )}
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
  const [selectedBand, setSelectedBand] = useState<TimeBand | null>(null);

  const [problemChecked, setProblemChecked] = useState<Record<string, boolean>>({});
  const [dataChecked, setDataChecked] = useState<Record<string, boolean>>({});
  const [riskChecked, setRiskChecked] = useState<Record<string, boolean>>({});

  const problemLevel = overallFromChecked(problemChecked, PROBLEM_CRITERIA);
  const dataLevel = overallFromChecked(dataChecked, DATA_CRITERIA);
  const riskLevel = overallFromChecked(riskChecked, RISK_CRITERIA);

  const mdmMiddleLevel = (() => {
    if (!problemLevel || !dataLevel || !riskLevel) return null;
    const levels = [problemLevel, dataLevel, riskLevel].sort((a, b) => a - b);
    return levels[1]; // 2-of-3 methodology
  })();

  const mdmOverall = (() => {
    if (mdmMiddleLevel === null) return null;
    if (mdmMiddleLevel >= 5) return "High";
    if (mdmMiddleLevel === 4) return "Moderate";
    if (mdmMiddleLevel === 3) return "Low";
    return "Straightforward";
  })();

  const bands = patientType === "new" ? TIME_BANDS_NEW : TIME_BANDS_ESTABLISHED;

  // MDM level maps to the same code family as the time bands (e.g.
  // established Level 3 MDM = 99213, same code as the 20-min time band).
  const mdmCode = mdmMiddleLevel !== null ? bands[Math.max(0, Math.min(3, mdmMiddleLevel - 2))]?.code : null;

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
            {patientType && (
              <div className="mb-3 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold" style={{ backgroundColor: CARD, color: BRAND }}>
                Showing time bands for: <span className="capitalize">{patientType}</span> Patient
              </div>
            )}
            <label className="text-xs font-medium text-slate-600 block mb-2">
              Select the highest time band whose minute threshold the total time on the date of service meets or exceeds
              {!patientType && <span className="text-amber-600"> — select a patient type above first</span>}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {bands.map((band) => (
                <button
                  key={band.code}
                  type="button"
                  disabled={!patientType}
                  onClick={() => setSelectedBand(band)}
                  className="rounded-md border px-3 py-2 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    borderColor: BRAND,
                    backgroundColor: selectedBand?.code === band.code ? BRAND : "white",
                    color: selectedBand?.code === band.code ? "white" : BRAND,
                  }}
                >
                  <div className="font-semibold">{band.code}</div>
                  <div>{band.label}</div>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Countable time includes: reviewing history, exam, counseling, ordering tests, documenting, and care coordination performed by the billing provider on the date of the encounter.
            </p>
            <div className="mt-3 rounded-md border border-amber-200 p-3 text-xs" style={{ backgroundColor: AMBER_LIGHT, color: AMBER }}>
              <b>Total time on DOS must meet or exceed</b> the selected band's threshold — select the highest band the total time reaches. If total time exceeds the top band ({bands[bands.length - 1].code}, {bands[bands.length - 1].label}+), a prolonged services add-on code may apply — not covered by this tool yet.
            </div>
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
            Result
          </div>
          {basis === "time" && selectedBand ? (
            <div className="text-lg font-bold text-slate-900">
              {selectedBand.code} — {selectedBand.label}+ (time-based)
            </div>
          ) : (
            <div className="text-lg font-bold text-slate-900">
              {mdmCode ?? "—"} — {mdmOverall} complexity (MDM-based)
            </div>
          )}
          <p className="mt-2 text-sm text-slate-600">
            Patient type: <b className="capitalize">{patientType ?? "not selected"}</b>
          </p>
          <div className="mt-3 rounded-md bg-white border border-slate-200 p-3 text-xs text-slate-500 italic">
            This is a decision-support estimate, not a final coding determination — always verify against the full documentation and your organization&apos;s coding policy before billing.
          </div>
        </div>
      )}

      <button onClick={reset} className="text-xs text-slate-500 hover:underline">
        Reset all selections
      </button>
    </div>
  );
}
