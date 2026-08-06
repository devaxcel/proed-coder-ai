"use client";

import { useState } from "react";
import Link from "next/link";

type Citation = {
  n: number;
  chunkId: string;
  policyDocId: string;
  source: string;
  docTitle: string;
  sourceUrl: string;
  excerpt: string;
};

type FormAOutput = {
  query_id_suggestion: string;
  priority: "concurrent" | "pre_bill" | "retro" | "audit";
  query_types: string[];
  impact_domains: string[];
  clinical_indicators: {
    source_document: string;
    indicators: string[];
  };
  clarification_question: string;
  clinically_reasonable_options: string[];
  poa_applicable: boolean;
  poa_context: string;
  reason_for_query: string;
  compliance_checklist: {
    cites_specific_indicators: boolean;
    offers_multiple_options: boolean;
    includes_other_and_unable_to_determine: boolean;
    non_leading: boolean;
    defines_reason_for_query: boolean;
  };
};

type HeaderInputs = {
  patientName?: string;
  mrn?: string;
  dob?: string;
  dateOfService?: string;
  setting?: string;
  payerType?: string;
  attendingProvider?: string;
  providerNpi?: string;
  providerSpecialty?: string;
  queryAuthorName?: string;
  queryAuthorRole?: string;
  queryAuthorContact?: string;
};

type GenResponse = {
  formType?: "A";
  form?: FormAOutput;
  header?: HeaderInputs;
  citations?: Citation[];
  latencyMs?: number;
  structured?: boolean;
  error?: string;
  raw?: string;
};

const QUERY_TYPE_LABELS: Record<string, string> = {
  diagnosis_specificity: "Diagnosis specificity",
  conflict_resolution: "Conflict resolution",
  procedure_operative: "Procedure / operative",
  poa_indicator: "POA indicator",
  em_level_mdm: "E/M level / MDM",
  modifier_support: "Modifier support",
  hcc_risk_adjustment: "HCC / risk adjustment",
  quality_hedis: "Quality / HEDIS",
  other: "Other",
};

const IMPACT_DOMAIN_LABELS: Record<string, string> = {
  ip_coding_drg: "IP coding / MS-DRG",
  op_professional_coding: "OP / professional",
  medical_necessity: "Medical necessity",
  quality_measure: "Quality measure",
  risk_adjustment_hcc: "Risk adjustment (HCC/RAF)",
  denial_audit_defense: "Denial / audit defense",
  patient_safety: "Patient safety",
  compliance_review: "Compliance review",
};

export default function QueryFormsPage() {
  const [scenario, setScenario] = useState("");
  const [showHeaderFields, setShowHeaderFields] = useState(false);
  const [header, setHeader] = useState<HeaderInputs>({});
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GenResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const examples = [
    {
      label: "Example 1 — Diabetes (T2DM specificity)",
      scenario:
        "Chart notes 'diabetes' for patient seen 3/15/2024. Progress note from same DOS shows HbA1c 8.2%, random glucose 240 mg/dL, on metformin 1000mg BID. No mention of type, control status, or complications. Need clarification for accurate coding.",
    },
    {
      label: "Example 2 — Heart failure (type not specified)",
      scenario:
        "Discharge summary states 'CHF exacerbation' with BNP 850, echo showing EF 30%, on lasix drip and metoprolol. Chart does not specify systolic vs diastolic, acute vs chronic. Provider needs to clarify HF classification.",
    },
    {
      label: "Example 3 — CKD (stage not documented)",
      scenario:
        "Problem list shows 'CKD' since 2022. Recent labs on 4/2/2024: eGFR 42, creatinine 1.7, urine albumin/creatinine ratio 180. No stage documented in current note. Need to clarify current CKD stage for accurate HCC capture.",
    },
    {
      label: "Example 4 — Pneumonia (organism/type)",
      scenario:
        "ED note dated 5/1/2024 states 'pneumonia' with sputum culture pending. Patient on IV cefepime, tachypneic, chest CT showing right lower lobe consolidation. Sputum came back day 2 positive for MRSA. Type not clarified in the record.",
    },
  ];

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!scenario.trim()) return;
    setLoading(true);
    setErr(null);
    setData(null);
    setSaved(false);
    try {
      const r = await fetch("/api/query-form/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, header }),
      });
      const json: GenResponse = await r.json();
      if (!r.ok || json.error) {
        setErr(json.error ?? `HTTP ${r.status}`);
      } else {
        setData(json);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function onExport() {
    if (!data?.form) return;
    try {
      const r = await fetch("/api/query-form/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form: data.form, header: data.header ?? header }),
      });
      if (!r.ok) throw new Error(`Export failed: ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ProEdCS-FormA-${data.form.query_id_suggestion || "Query"}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Export failed");
    }
  }

  async function onSave() {
    if (!data?.form) return;
    setSaving(true);
    try {
      const previewText = buildPreviewText(data.form);
      const r = await fetch("/api/query-form/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          draft: previewText,
          formType: "A",
          formPayload: data.form,
          headerPayload: data.header ?? header,
        }),
      });
      if (r.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function onCopy() {
    if (!data?.form) return;
    const text = buildPreviewText(data.form);
    await navigator.clipboard.writeText(text);
  }

  const form = data?.form;

  return (
    <div className="space-y-8">
      <section className="rounded-xl bg-navy px-6 py-12 md:px-12 md:py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="inline-flex items-center rounded-md bg-white/10 px-3 py-1 text-xs font-medium text-white/80 mb-4">
            Query Forms · Form A (General Clinical Documentation Query)
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white leading-snug">
            Draft a compliant physician query.
          </h1>
          <p className="mt-3 text-sm text-white/70">
            Describe the documentation gap in your own words. The tool extracts structured Form A fields grounded in ACDIS/AHIMA 2026 guidelines, then generates a print-ready DOCX matching the ProEdCS Query Forms Packet.
          </p>

          <div className="mt-8 text-left">
            <textarea
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              rows={5}
              placeholder="e.g. Chart notes 'diabetes' for patient seen 3/15/2024. HbA1c 8.2%, glucose 240, on metformin. Missing: type, control, complications."
              className="w-full rounded-md border-0 bg-white px-5 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-yellow resize-none"
            />
            <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs">
              <span className="text-white/60">Try:</span>
              {examples.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setScenario(ex.scenario)}
                  className="text-white/90 underline underline-offset-2 hover:text-accent-yellow"
                >
                  Example {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <form onSubmit={onGenerate} className="space-y-5">
        <div>
          <button
            type="button"
            onClick={() => setShowHeaderFields((v) => !v)}
            className="text-xs text-brand-600 hover:underline"
          >
            {showHeaderFields ? "− Hide optional header fields" : "+ Show optional header fields (patient, provider, coder info)"}
          </button>
          {showHeaderFields && (
            <div className="mt-3 grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
              <InputField label="Patient Name" value={header.patientName} onChange={(v) => setHeader({ ...header, patientName: v })} />
              <InputField label="MRN / Account #" value={header.mrn} onChange={(v) => setHeader({ ...header, mrn: v })} />
              <InputField label="DOB" value={header.dob} onChange={(v) => setHeader({ ...header, dob: v })} />
              <InputField label="Date of Service" value={header.dateOfService} onChange={(v) => setHeader({ ...header, dateOfService: v })} />
              <SelectField label="Setting" options={["IP", "OP", "ED", "SNF", "Home", "Telehealth", "Other"]} value={header.setting} onChange={(v) => setHeader({ ...header, setting: v })} />
              <SelectField label="Payer Type" options={["Medicare", "Medicaid", "Commercial", "MA", "Self-pay"]} value={header.payerType} onChange={(v) => setHeader({ ...header, payerType: v })} />
              <InputField label="Attending / Rendering Provider" value={header.attendingProvider} onChange={(v) => setHeader({ ...header, attendingProvider: v })} />
              <InputField label="Provider NPI" value={header.providerNpi} onChange={(v) => setHeader({ ...header, providerNpi: v })} />
              <InputField label="Specialty" value={header.providerSpecialty} onChange={(v) => setHeader({ ...header, providerSpecialty: v })} />
              <InputField label="Query Author Name / Credentials" value={header.queryAuthorName} onChange={(v) => setHeader({ ...header, queryAuthorName: v })} />
              <SelectField label="Author Role" options={["CDI", "Coder", "Auditor", "Other"]} value={header.queryAuthorRole} onChange={(v) => setHeader({ ...header, queryAuthorRole: v })} />
              <InputField label="Contact / Ext" value={header.queryAuthorContact} onChange={(v) => setHeader({ ...header, queryAuthorContact: v })} />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !scenario.trim()}
          className="rounded-md bg-brand-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Extracting Form A fields…" : "Draft Form A query"}
        </button>
      </form>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {form && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{data?.latencyMs}ms</span>
              <span>·</span>
              <span>Query ID: {form.query_id_suggestion || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onCopy} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                Copy
              </button>
              <button onClick={onSave} disabled={saving} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {saved ? "✓ Saved" : saving ? "Saving…" : "Save"}
              </button>
              <button onClick={onExport} className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
                ⬇ DOCX (Form A)
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
              <span className="rounded bg-brand-100 px-2 py-0.5 font-medium text-brand-700">Form A Preview</span>
              <span>· Print-ready DOCX matches ProEdCS packet format</span>
            </div>

            <SectionTitle n="1" title="Query Header" />
            <div className="mb-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <MetaCell label="Query ID" value={form.query_id_suggestion || "—"} />
              <MetaCell label="Priority" value={form.priority.replace(/_/g, "-")} />
              <MetaCell label="Types" value={form.query_types.map((t) => QUERY_TYPE_LABELS[t] ?? t).join(", ") || "—"} />
              <MetaCell label="POA applicable" value={form.poa_applicable ? "Yes" : "No"} />
            </div>

            <SectionTitle n="2" title="Query Type & Impact Domain" />
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-brand-600">Query Types</div>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {Object.entries(QUERY_TYPE_LABELS).map(([k, label]) => (
                    <li key={k} className={form.query_types.includes(k) ? "text-slate-900" : "text-slate-400"}>
                      {form.query_types.includes(k) ? "☑" : "☐"} {label}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-brand-600">Impact Domain</div>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {Object.entries(IMPACT_DOMAIN_LABELS).map(([k, label]) => (
                    <li key={k} className={form.impact_domains.includes(k) ? "text-slate-900" : "text-slate-400"}>
                      {form.impact_domains.includes(k) ? "☑" : "☐"} {label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <SectionTitle n="3" title="Clinical Indicators from the Medical Record" />
            <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold text-brand-600">Source document</div>
              <div className="mb-2">{form.clinical_indicators.source_document || "—"}</div>
              <div className="text-xs font-semibold text-brand-600">Indicators</div>
              <ul className="mt-1 space-y-0.5">
                {form.clinical_indicators.indicators.map((ind, i) => (
                  <li key={i}>• {ind}</li>
                ))}
              </ul>
            </div>

            <SectionTitle n="4" title="Clarification Request (Non-Leading)" />
            <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="mb-3 font-medium">{form.clarification_question}</div>
              <div className="text-xs font-semibold text-brand-600 mb-1">Clinically reasonable options</div>
              <ul className="space-y-0.5">
                {["A", "B", "C", "D"].map((letter, i) => {
                  const opt = form.clinically_reasonable_options[i];
                  return (
                    <li key={letter} className={opt ? "" : "text-slate-400"}>
                      ☐ Option {letter}: {opt || "—"}
                    </li>
                  );
                })}
                <li>☐ Other (please specify)</li>
                <li>☐ Unable to determine / Not clinically indicated</li>
                <li>☐ The condition was ruled out</li>
              </ul>
              {form.poa_applicable && (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs">
                  <b>POA required:</b> {form.poa_context || "Confirm Present on Admission status if inpatient."}
                </div>
              )}
            </div>

            {form.reason_for_query && (
              <div className="mb-4 text-xs italic text-slate-600">
                <b>Reason for query:</b> {form.reason_for_query}
              </div>
            )}

            <SectionTitle n="5–6" title="Provider Response + CDI Disposition" />
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
              These sections remain blank on the printed DOCX — the provider fills them after receiving the query, and the CDI/coder completes the disposition after response.
            </div>

            <div className="mt-4 flex flex-wrap gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs">
              <b>Compliance checklist:</b>
              <span>{form.compliance_checklist.cites_specific_indicators ? "✓" : "✗"} Cites indicators</span>
              <span>{form.compliance_checklist.offers_multiple_options ? "✓" : "✗"} Multi-choice</span>
              <span>{form.compliance_checklist.includes_other_and_unable_to_determine ? "✓" : "✗"} Other/UTD</span>
              <span>{form.compliance_checklist.non_leading ? "✓" : "✗"} Non-leading</span>
              <span>{form.compliance_checklist.defines_reason_for_query ? "✓" : "✗"} Reason defined</span>
            </div>
          </div>

          {data?.citations && data.citations.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Policy references grounding this draft
              </h2>
              <ol className="space-y-2">
                {data.citations.map((c) => (
                  <li key={c.n} className="rounded-md border border-indigo-100 bg-indigo-50 p-3 text-xs">
                    <div className="font-medium">
                      [{c.n}] {c.source} · {c.docTitle}
                    </div>
                    <div className="mt-1 italic text-slate-700">&ldquo;{c.excerpt}&rdquo;</div>
                    <div className="mt-2 flex gap-3">
                      <a
                        href={`/api/policies/document/${c.policyDocId}`}
                        className="text-brand-700 hover:underline"
                      >
                        ⬇ Download policy (DOCX)
                      </a>
                      {c.sourceUrl && (
                        <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
                          Open source →
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Need something different? Try the{" "}
            <Link href="/policies" className="text-brand-600 hover:underline">
              Policies Q&amp;A
            </Link>{" "}
            for compliance research, or view your{" "}
            <Link href="/query-forms/history" className="text-brand-600 hover:underline">
              query history
            </Link>
            .
          </div>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-brand-600">
      Section {n}. {title}
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}

function InputField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-0.5 block text-xs font-medium text-slate-600">{label}</label>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value?: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="mb-0.5 block text-xs font-medium text-slate-600">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function buildPreviewText(f: FormAOutput): string {
  const lines: string[] = [
    `ProEdCS Query Form A — General Clinical Documentation Query`,
    `Query ID: ${f.query_id_suggestion || "—"}  ·  Priority: ${f.priority}`,
    ``,
    `Clinical Indicators (source: ${f.clinical_indicators.source_document || "—"}):`,
    ...f.clinical_indicators.indicators.map((i) => `  • ${i}`),
    ``,
    `Clarification Question:`,
    `  ${f.clarification_question}`,
    ``,
    `Clinically reasonable options:`,
    ...f.clinically_reasonable_options.map((o, i) => `  ${String.fromCharCode(65 + i)}) ${o}`),
    `  Other (please specify)`,
    `  Unable to determine / Not clinically indicated`,
    `  The condition was ruled out`,
    ``,
    `Reason for query: ${f.reason_for_query || "—"}`,
  ];
  if (f.poa_applicable) {
    lines.push(``, `POA required: ${f.poa_context || "Confirm Present on Admission status."}`);
  }
  return lines.join("\n");
}
