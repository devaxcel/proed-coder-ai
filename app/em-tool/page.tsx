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
  { code: "99212", minMinutes: 10, label: "10–19 min" },
  { code: "99213", minMinutes: 20, label: "20–29 min" },
  { code: "99214", minMinutes: 30, label: "30–39 min" },
  { code: "99215", minMinutes: 40, label: "40+ min" },
];

const TIME_BANDS_NEW: TimeBand[] = [
  { code: "99202", minMinutes: 15, label: "15–29 min" },
  { code: "99203", minMinutes: 30, label: "30–44 min" },
  { code: "99204", minMinutes: 45, label: "45–59 min" },
  { code: "99205", minMinutes: 60, label: "60+ min" },
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold mb-1" style={{ color: BRAND }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
      />
    </label>
  );
}

type SavedCase = {
  id: string;
  patientName: string;
  accountNumber: string;
  dos: string;
  npi: string;
  patientType: PatientType;
  basis: Basis;
  // Time-based
  timeCode: string | null;
  timeLabel: string | null;
  // MDM-based
  problemLevel: number;
  dataLevel: number;
  riskLevel: number;
  mdmFinalLevel: number | null;
  mdmOverall: string | null;
  mdmCode: string | null;
  wasDowncoded: boolean;
};

export default function EMToolPage() {
  const [basis, setBasis] = useState<Basis>(null);
  const [patientType, setPatientType] = useState<PatientType>(null);
  const [selectedBand, setSelectedBand] = useState<TimeBand | null>(null);

  const [problemChecked, setProblemChecked] = useState<Record<string, boolean>>({});
  const [dataChecked, setDataChecked] = useState<Record<string, boolean>>({});
  const [riskChecked, setRiskChecked] = useState<Record<string, boolean>>({});

  // Patient info — same fields/pattern as the MEAT HCC tool, so cases can
  // be identified on a printed/exported record.
  const [patientName, setPatientName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [dos, setDos] = useState("");
  const [npi, setNpi] = useState("");

  const [savedCases, setSavedCases] = useState<SavedCase[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "batch" | null>(null);

  const problemLevel = overallFromChecked(problemChecked, PROBLEM_CRITERIA);
  const dataLevel = overallFromChecked(dataChecked, DATA_CRITERIA);
  const riskLevel = overallFromChecked(riskChecked, RISK_CRITERIA);

  // ------------------------------------------------------------------
  // MDM leveling — PER PROED POLICY (explicitly requested Oct 2026,
  // overriding the standard CMS/AMA 2021 "2-of-3 elements" methodology):
  // all three MDM elements (Problems, Data, Risk) must be at the SAME
  // level. If they are not all equal, the encounter is downcoded to the
  // LOWEST of the three levels, with an explanation shown on screen and
  // on the printed/exported record.
  //
  // NOTE: this is NOT the CMS/AMA national standard, which sets the MDM
  // level at whichever level 2 of the 3 elements meet or exceed (so e.g.
  // 4-2-4 is correctly Level 4 under CMS/AMA, not Level 2). This was
  // flagged to the requester before implementation; they confirmed they
  // want the "all three must match, else downcode to lowest" rule
  // implemented as described. If ProEd's policy changes, change
  // `mdmFinalLevel` below back to the 2-of-3 "middle value" calculation.
  // ------------------------------------------------------------------
  const allThreeSelected = problemLevel > 0 && dataLevel > 0 && riskLevel > 0;
  const allThreeEqual = allThreeSelected && problemLevel === dataLevel && dataLevel === riskLevel;
  const mdmFinalLevel = allThreeSelected ? Math.min(problemLevel, dataLevel, riskLevel) : null;
  const wasDowncoded = allThreeSelected && !allThreeEqual;

  const mdmOverall = (() => {
    if (mdmFinalLevel === null) return null;
    if (mdmFinalLevel >= 5) return "High";
    if (mdmFinalLevel === 4) return "Moderate";
    if (mdmFinalLevel === 3) return "Low";
    return "Straightforward";
  })();

  const bands = patientType === "new" ? TIME_BANDS_NEW : TIME_BANDS_ESTABLISHED;

  // MDM level maps to the same code family as the time bands (e.g.
  // established Level 3 MDM = 99213, same code as the 20-min time band).
  const mdmCode = mdmFinalLevel !== null ? bands[Math.max(0, Math.min(3, mdmFinalLevel - 2))]?.code : null;

  function toggle(setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, key: string) {
    setter((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function resetForm() {
    setBasis(null);
    setPatientType(null);
    setSelectedBand(null);
    setProblemChecked({});
    setDataChecked({});
    setRiskChecked({});
    setPatientName("");
    setAccountNumber("");
    setDos("");
    setNpi("");
  }

  const hasResult = (basis === "time" && !!selectedBand) || (basis === "mdm" && !!mdmOverall);

  function onSaveToBatch() {
    if (!hasResult) return;
    const entry: SavedCase = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      patientName,
      accountNumber,
      dos,
      npi,
      patientType,
      basis,
      timeCode: basis === "time" ? selectedBand?.code ?? null : null,
      timeLabel: basis === "time" ? selectedBand?.label ?? null : null,
      problemLevel,
      dataLevel,
      riskLevel,
      mdmFinalLevel,
      mdmOverall,
      mdmCode,
      wasDowncoded,
    };
    setSavedCases((prev) => [...prev, entry]);
    setSaveMessage(`Saved "${patientName || "(unnamed patient)"}" to batch — ${savedCases.length + 1} case(s) queued.`);
    resetForm();
    setTimeout(() => setSaveMessage(null), 4000);
  }

  function onRemoveSaved(id: string) {
    setSavedCases((prev) => prev.filter((c) => c.id !== id));
  }

  async function downloadBlob(res: Response, filename: string) {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function onExportPdf() {
    if (!hasResult) return;
    setExporting("pdf");
    try {
      const res = await fetch("/api/em-tool/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          accountNumber,
          dos,
          npi,
          patientType,
          basis,
          timeCode: basis === "time" ? selectedBand?.code ?? null : null,
          timeLabel: basis === "time" ? selectedBand?.label ?? null : null,
          problemLevel,
          dataLevel,
          riskLevel,
          mdmFinalLevel,
          mdmOverall,
          mdmCode,
          wasDowncoded,
        }),
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      await downloadBlob(res, `ProEdCS-EM-Level-${Date.now()}.pdf`);
    } finally {
      setExporting(null);
    }
  }

  async function onExportBatch() {
    if (savedCases.length === 0) return;
    setExporting("batch");
    try {
      const res = await fetch("/api/em-tool/export-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cases: savedCases }),
      });
      if (!res.ok) throw new Error(`Batch export failed: ${res.status}`);
      await downloadBlob(res, `ProEdCS-EM-Level-Batch-${savedCases.length}-Patients-${Date.now()}.docx`);
    } finally {
      setExporting(null);
    }
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

      {/* Saved cases batch panel */}
      {savedCases.length > 0 && (
        <div className="rounded-lg border p-4" style={{ borderColor: BRAND }}>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h2 className="text-sm font-semibold" style={{ color: BRAND }}>
              Saved Cases for Batch Export ({savedCases.length})
            </h2>
            <button
              onClick={onExportBatch}
              disabled={exporting !== null}
              className="rounded-md px-4 py-2 text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: BRAND }}
            >
              {exporting === "batch" ? "Generating…" : `⬇ Export Batch (${savedCases.length} Patients, DOCX)`}
            </button>
          </div>
          <ul className="divide-y divide-slate-100">
            {savedCases.map((c) => {
              const code = c.basis === "time" ? c.timeCode : c.mdmCode;
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-slate-900">{c.patientName || "(unnamed patient)"}</span>
                    {c.accountNumber && <span className="text-slate-500"> · Acct {c.accountNumber}</span>}
                    <span className="text-slate-500"> · {code ?? "—"}</span>
                    {c.wasDowncoded && (
                      <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: AMBER }}>
                        Downcoded
                      </span>
                    )}
                  </div>
                  <button onClick={() => onRemoveSaved(c.id)} className="text-xs text-red-600 hover:text-red-800">
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {saveMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
          ✓ {saveMessage}
        </div>
      )}

      {/* Patient info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-lg border p-4" style={{ borderColor: CARD, backgroundColor: CARD }}>
        <Field label="Patient Name" value={patientName} onChange={setPatientName} placeholder="Last, First" />
        <Field label="Account Number" value={accountNumber} onChange={setAccountNumber} placeholder="MRN / Account #" />
        <Field label="Date of Service" value={dos} onChange={setDos} type="date" />
        <Field label="Provider NPI" value={npi} onChange={setNpi} />
      </div>

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
              <b>Total time on DOS must meet or exceed</b> the selected band's threshold — select the highest band the total time reaches. If total time exceeds the top band ({bands[bands.length - 1].code}, {bands[bands.length - 1].label}), a prolonged services add-on code may apply — not covered by this tool yet.
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
      {hasResult && (
        <div className="rounded-lg border p-5" style={{ borderColor: BRAND, backgroundColor: CARD }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: BRAND }}>
            Result
          </div>
          {basis === "time" && selectedBand ? (
            <div className="text-lg font-bold text-slate-900">
              {selectedBand.code} — {selectedBand.label} (time-based)
            </div>
          ) : (
            <div className="text-lg font-bold text-slate-900">
              {mdmCode ?? "—"} — {mdmOverall} complexity (MDM-based)
            </div>
          )}
          <p className="mt-2 text-sm text-slate-600">
            Patient type: <b className="capitalize">{patientType ?? "not selected"}</b>
          </p>

          {basis === "mdm" && allThreeSelected && (
            <div
              className="mt-3 rounded-md border p-3 text-xs"
              style={wasDowncoded ? { backgroundColor: AMBER_LIGHT, borderColor: AMBER, color: AMBER } : { backgroundColor: "white", borderColor: BRAND, color: "#334155" }}
            >
              {wasDowncoded ? (
                <>
                  <b>Downcoded.</b> Problems = Level {problemLevel}, Data = Level {dataLevel}, Risk = Level {riskLevel} — these three elements are not all at the same level.
                  Per ProEd policy, all three MDM elements must match; when they don&apos;t, the encounter is downcoded to the lowest of the three: <b>Level {mdmFinalLevel} ({mdmCode})</b>.
                </>
              ) : (
                <>
                  <b>No downcoding.</b> All three MDM elements (Problems, Data, Risk) are at Level {mdmFinalLevel} — code reflects that level directly.
                </>
              )}
            </div>
          )}

          <div className="mt-3 rounded-md bg-white border border-slate-200 p-3 text-xs text-slate-500 italic">
            This is a decision-support estimate, not a final coding determination — always verify against the full documentation and your organization&apos;s coding policy before billing.
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={onSaveToBatch}
              className="rounded-md px-4 py-2 text-xs font-medium border"
              style={{ borderColor: BRAND, color: BRAND, backgroundColor: "white" }}
            >
              + Save to Batch
            </button>
            <button
              onClick={onExportPdf}
              disabled={exporting !== null}
              className="rounded-md px-4 py-2 text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: BRAND }}
            >
              {exporting === "pdf" ? "Generating…" : "⬇ Print / Export This Case (PDF)"}
            </button>
          </div>
        </div>
      )}

      <button onClick={resetForm} className="text-xs text-slate-500 hover:underline">
        Reset all selections
      </button>
    </div>
  );
}
