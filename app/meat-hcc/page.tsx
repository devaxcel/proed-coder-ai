"use client";

import { useState } from "react";

type ChecklistState = Record<string, boolean>;

const TEAL = "#14457B";
const TEAL_LIGHT = "#E7ECF4";
const TEAL_DARK = "#14457B";

const MONITORED = [
  { id: "m1", label: "Vital signs reviewed (BP, weight, O2 sat, HR)", ex: "e.g., BP 142/90 noted; weight stable" },
  { id: "m2", label: "Symptom frequency/severity documented", ex: "e.g., SOB with exertion 3x/week (CHF)" },
  { id: "m3", label: "Disease progression assessed", ex: "e.g., A1c trend worsening over 6 months" },
  { id: "m4", label: "Functional status/ADL impact noted", ex: "e.g., limited ambulation due to neuropathy" },
  { id: "m5", label: "Complications or new symptoms identified", ex: "e.g., new lower extremity edema" },
];
const EVALUATED = [
  { id: "e1", label: "Lab results reviewed & interpreted", ex: "e.g., A1c 8.4%, eGFR 58 (DM with CKD)" },
  { id: "e2", label: "Imaging/diagnostic studies reviewed", ex: "e.g., Echo EF 35% reviewed (CHF)" },
  { id: "e3", label: "Medication efficacy assessed", ex: "e.g., metformin dose adequate, A1c improving" },
  { id: "e4", label: "Side effects/tolerance evaluated", ex: "e.g., ACE inhibitor causing dry cough" },
  { id: "e5", label: "Specialist reports reviewed", ex: "e.g., nephrology note reviewed for CKD mgmt" },
];
const ASSESSED = [
  { id: "a1", label: "Condition status: Stable / Improving / Worsening", ex: "e.g., DM2 — poorly controlled (worsening)" },
  { id: "a2", label: "Acute vs. chronic distinction documented", ex: "e.g., acute-on-chronic CHF exacerbation" },
  { id: "a3", label: "Comorbidity interactions addressed", ex: "e.g., DM + HTN interaction documented" },
  { id: "a4", label: "Risk stratification noted", ex: "e.g., LVEF <40% — high-risk CHF class III" },
  { id: "a5", label: "Patient education/counseling addressed", ex: "e.g., low-sodium diet counseling provided" },
];
const TREATED = [
  { id: "t1", label: "Current medications listed with dosage", ex: "e.g., metformin 1000mg BID, lisinopril 10mg" },
  { id: "t2", label: "New Rx or dosage change documented", ex: "e.g., increased furosemide 40mg→80mg (CHF)" },
  { id: "t3", label: "Referrals ordered or pending", ex: "e.g., referral to endocrinology for DM2" },
  { id: "t4", label: "Procedures/interventions performed", ex: "e.g., wound care for diabetic foot ulcer" },
  { id: "t5", label: "Follow-up plan & frequency specified", ex: "e.g., return visit in 3 months for A1c recheck" },
];

const QUICK_REF = [
  { hcc: "Diabetes w/ Complications", sub: "(HCC 18/19)", codes: "E11.65, E11.40, E11.51, E11.319", must: "A1c value, insulin/oral med, complication (neuro/nephro/retino), current management plan" },
  { hcc: "Congestive Heart Failure", sub: "(HCC 85/86)", codes: "I50.20, I50.30, I50.40, I50.9", must: "EF%, NYHA class, current diuretic/ARNI/BB, BNP/echo result, fluid status assessment" },
  { hcc: "CKD Stage 3–5", sub: "(HCC 136/137)", codes: "N18.3, N18.4, N18.5, N18.6", must: "eGFR value & trend, BMP reviewed, proteinuria, nephrology consult if applicable" },
  { hcc: "COPD/Asthma", sub: "(HCC 111)", codes: "J44.0, J44.1, J45.50, J45.51", must: "Spirometry/FEV1, inhaler regimen, exacerbation frequency, O2 sat, smoking status" },
  { hcc: "Vascular Disease", sub: "(HCC 108/107)", codes: "I25.10, I70.213, I73.9, I71.4", must: "Statin therapy, antiplatelet use, last imaging date, symptom severity, revascularization hx" },
];

function Section({
  letter,
  title,
  items,
  checked,
  onToggle,
  isMet,
}: {
  letter: string;
  title: string;
  items: { id: string; label: string; ex: string }[];
  checked: ChecklistState;
  onToggle: (id: string) => void;
  isMet: boolean;
}) {
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: TEAL }}>
      <div className="px-4 py-2 text-white font-semibold text-sm flex items-center justify-between" style={{ backgroundColor: TEAL }}>
        <span>{letter} &nbsp; {title}</span>
        {isMet && (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">✓ Met</span>
        )}
      </div>
      <div className="p-4 space-y-3 bg-white">
        {items.map((it) => (
          <label key={it.id} className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!checked[it.id]}
              onChange={() => onToggle(it.id)}
              className="mt-1 h-4 w-4 rounded border-slate-300 focus:ring-1"
              style={{ accentColor: TEAL }}
            />
            <span>
              <span className="block text-sm text-slate-900">{it.label}</span>
              <span className="block text-xs italic text-slate-500">{it.ex}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function MeatHccPage() {
  const [icdCodes, setIcdCodes] = useState("");
  const [condition, setCondition] = useState("");
  const [dos, setDos] = useState("");
  const [npi, setNpi] = useState("");
  const [notes, setNotes] = useState("");
  const [checked, setChecked] = useState<ChecklistState>({});
  const [exporting, setExporting] = useState<"docx" | "pdf" | null>(null);

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const allItems = [...MONITORED, ...EVALUATED, ...ASSESSED, ...TREATED];
  const checkedCount = allItems.filter((it) => checked[it.id]).length;

  // Per ProEd policy: a diagnosis is only considered validated for medical
  // necessity documentation when at least 3 of the 4 MEAT quadrants
  // (Monitored, Evaluated, Assessed, Treated) have at least one item
  // checked — not a count of individual checkboxes, but of quadrants met.
  const monitoredMet = MONITORED.some((it) => checked[it.id]);
  const evaluatedMet = EVALUATED.some((it) => checked[it.id]);
  const assessedMet = ASSESSED.some((it) => checked[it.id]);
  const treatedMet = TREATED.some((it) => checked[it.id]);
  const quadrantsMetCount = [monitoredMet, evaluatedMet, assessedMet, treatedMet].filter(Boolean).length;
  const isValidated = quadrantsMetCount >= 3;

  async function onExport(format: "docx" | "pdf") {
    setExporting(format);
    try {
      const endpoint = format === "docx" ? "/api/meat-hcc/export" : "/api/meat-hcc/export-pdf";
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icdCodes, condition, dos, npi, notes, checked }),
      });
      if (!r.ok) throw new Error(`Export failed: ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ProEdCS-MEAT-HCC-Checklist-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header bar matching ProEd's original document style */}
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3" style={{ backgroundColor: TEAL }}>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white leading-snug">
              MEAT Documentation Checklist
            </h1>
            <p className="mt-1 text-sm text-white/85">
              HCC Risk Adjustment Coding — Applicable to All Chronic Conditions
            </p>
          </div>
          <div className="rounded-md bg-white/95 px-3 py-2 shadow-sm">
            <img src="/proed-logo.png" alt="ProEd Consulting" className="h-8 w-auto" />
          </div>
        </div>
        <p className="text-xs text-slate-500 px-6 py-2 bg-slate-50 border-t border-slate-200">
          Each chronic condition documented must demonstrate active management via MEAT criteria. Check all applicable items and record ICD-10 code(s) below. <b>Minimum requirement: at least 3 of the 4 MEAT components (Monitored, Evaluated, Assessed, Treated) must have at least one item checked to validate this diagnosis.</b>
        </p>
      </section>

      {/* Header fields */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-lg border p-4" style={{ borderColor: TEAL_LIGHT, backgroundColor: TEAL_LIGHT }}>
        <Field label="Date of Service" value={dos} onChange={setDos} teal={TEAL} type="date" />
        <Field label="Provider NPI" value={npi} onChange={setNpi} teal={TEAL} />
        <Field label="ICD-10 Code(s)" value={icdCodes} onChange={setIcdCodes} placeholder="e.g., E11.40, N18.4" teal={TEAL} />
        <Field label="Condition/Diagnosis" value={condition} onChange={setCondition} placeholder="e.g., DM2 with CKD" teal={TEAL} />
      </div>

      {/* Progress */}
      <div className="text-sm text-slate-600">
        <span className="font-semibold" style={{ color: TEAL }}>{checkedCount}</span> of {allItems.length} elements documented
      </div>

      {/* MEAT grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section letter="M" title="MONITORED — Signs, Symptoms & Progression" items={MONITORED} checked={checked} onToggle={toggle} isMet={monitoredMet} />
        <Section letter="E" title="EVALUATED — Tests & Medication Efficacy" items={EVALUATED} checked={checked} onToggle={toggle} isMet={evaluatedMet} />
        <Section letter="A" title="ASSESSED/ADDRESSED — Stability & Complications" items={ASSESSED} checked={checked} onToggle={toggle} isMet={assessedMet} />
        <Section letter="T" title="TREATED — Medications, Therapy & Referrals" items={TREATED} checked={checked} onToggle={toggle} isMet={treatedMet} />
      </div>

      {/* Quick reference */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: TEAL }}>
        <div className="px-4 py-2 text-white font-semibold text-sm" style={{ backgroundColor: TEAL }}>
          COMMON HCC QUICK REFERENCE — Documentation Must-Haves
        </div>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: TEAL_DARK }} className="text-left">
            <tr>
              <th className="px-3 py-2 font-medium text-white">HCC Category</th>
              <th className="px-3 py-2 font-medium text-white">Key ICD-10 Codes</th>
              <th className="px-3 py-2 font-medium text-white">MEAT Must-Document</th>
            </tr>
          </thead>
          <tbody>
            {QUICK_REF.map((row, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? TEAL_LIGHT : "#FFFFFF" }}>
                <td className="px-3 py-2 align-top">
                  <div className="font-medium text-slate-900">{row.hcc}</div>
                  <div className="text-xs text-slate-500">{row.sub}</div>
                </td>
                <td className="px-3 py-2 align-top text-slate-700">{row.codes}</td>
                <td className="px-3 py-2 align-top text-slate-700">{row.must}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Provider notes */}
      <div className="rounded-lg border p-4" style={{ borderColor: TEAL }}>
        <label className="mb-1 block text-sm font-medium" style={{ color: TEAL_DARK }}>
          Provider Notes / Additional Documentation
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-1"
          style={{ borderColor: "#CBD5E1" }}
        />
      </div>

      {/* Attestation + MEAT validation status */}
      <div
        className="rounded-lg border p-4 text-sm"
        style={{ borderColor: isValidated ? "#059669" : "#DC2626", backgroundColor: isValidated ? "#ECFDF5" : "#FEF2F2" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
            style={{ backgroundColor: isValidated ? "#059669" : "#DC2626" }}
          >
            {isValidated ? `✓ Validated — ${quadrantsMetCount} of 4 met` : `${quadrantsMetCount} of 4 met — not yet validated`}
          </span>
        </div>
        <p className="text-slate-700">
          <b>Attestation:</b> I certify that the above documentation reflects my clinical assessment and active management of the listed chronic condition(s).
        </p>
      </div>

      {!isValidated && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          ⚠ Export is disabled until at least 3 of the 4 MEAT components are met. Currently: {quadrantsMetCount} of 4.
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => onExport("docx")}
          disabled={exporting !== null || !isValidated}
          title={!isValidated ? "Minimum 3 of 4 MEAT components must be met before exporting" : undefined}
          className="rounded-md px-5 py-3 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: TEAL }}
        >
          {exporting === "docx" ? "Generating…" : "⬇ Export Checklist (DOCX)"}
        </button>
        <button
          onClick={() => onExport("pdf")}
          disabled={exporting !== null || !isValidated}
          title={!isValidated ? "Minimum 3 of 4 MEAT components must be met before exporting" : undefined}
          className="rounded-md px-5 py-3 text-sm font-medium border disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderColor: TEAL, color: TEAL_DARK, backgroundColor: "white" }}
        >
          {exporting === "pdf" ? "Generating…" : "⬇ Export Checklist (PDF)"}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        MEAT criteria per CMS HCC Risk Adjustment guidelines · ProEd Consulting — HCC Documentation Support
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  teal,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  teal: string;
  type?: "text" | "date";
}) {
  return (
    <div>
      <label className="mb-0.5 block text-xs font-medium" style={{ color: teal }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1"
      />
    </div>
  );
}
