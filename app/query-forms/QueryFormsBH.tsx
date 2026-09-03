"use client";

import { useState } from "react";
import Link from "next/link";
import { AIOutputDisclaimer, NoPHIWarning } from "@/lib/disclaimers";

const BRAND = "#14457B";

type FormLetter = "B" | "C" | "D" | "E" | "F" | "G" | "H";

const FORM_OPTIONS: { letter: FormLetter; title: string }[] = [
  { letter: "B", title: "Provider Clarification / Dispute Request" },
  { letter: "C", title: "Inpatient Diagnosis Specificity / CC-MCC / POA" },
  { letter: "D", title: "Outpatient E/M Level / MDM / Time" },
  { letter: "E", title: "Procedure / Operative / Modifier Documentation" },
  { letter: "F", title: "HCC / Risk Adjustment Chronic Condition" },
  { letter: "G", title: "Quality / HEDIS Gaps-in-Care" },
  { letter: "H", title: "Audit Findings Response (Rebuttal)" },
];

type Citation = {
  n: number;
  chunkId: string;
  policyDocId: string;
  source: string;
  docTitle: string;
  sourceUrl: string;
  excerpt: string;
};

type FormOutput = {
  form_letter: FormLetter;
  title: string;
  query_id_suggestion: string;
  priority: string;
  summary_line: string;
  detail_sections: { heading: string; body: string }[];
  question: string;
  options: string[];
  reason: string;
};

type HeaderInputs = {
  patientName?: string;
  mrn?: string;
  dob?: string;
  dateOfService?: string;
  attendingProvider?: string;
  queryAuthorName?: string;
};

export default function QueryFormsBH() {
  const [letter, setLetter] = useState<FormLetter>("B");
  const [scenario, setScenario] = useState("");
  const [header, setHeader] = useState<HeaderInputs>({});
  const [showHeader, setShowHeader] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState<FormOutput | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const currentTitle = FORM_OPTIONS.find((f) => f.letter === letter)?.title ?? "";

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!scenario.trim()) return;
    setLoading(true);
    setErr(null);
    setForm(null);
    try {
      const r = await fetch("/api/query-form/generate-bh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formLetter: letter, scenario, header }),
      });
      const json = await r.json();
      if (!r.ok || json.error) {
        setErr(json.error ?? `HTTP ${r.status}`);
      } else {
        setForm(json.form);
        setCitations(json.citations ?? []);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function onExport() {
    if (!form) return;
    setExporting(true);
    try {
      const r = await fetch("/api/query-form/export-bh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, header }),
      });
      if (!r.ok) throw new Error(`Export failed: ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ProEdCS-Form${form.form_letter}-${form.query_id_suggestion || "Query"}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h2 className="text-lg font-bold text-white">Forms B–H</h2>
          <p className="mt-1 text-sm text-white/85">
            Select a form type, describe the scenario, and draft a compliant, print-ready packet form.
          </p>
        </div>
      </section>

      <AIOutputDisclaimer />

      {/* Form letter selector */}
      <div className="flex flex-wrap gap-2">
        {FORM_OPTIONS.map((opt) => (
          <button
            key={opt.letter}
            onClick={() => {
              setLetter(opt.letter);
              setForm(null);
            }}
            className="rounded-md px-3 py-2 text-xs font-medium border transition"
            style={{
              borderColor: BRAND,
              backgroundColor: letter === opt.letter ? BRAND : "white",
              color: letter === opt.letter ? "white" : BRAND,
            }}
          >
            Form {opt.letter}
          </button>
        ))}
      </div>
      <p className="text-sm text-slate-600">
        <b>Form {letter}:</b> {currentTitle}
      </p>

      <form onSubmit={onGenerate} className="space-y-4">
        <NoPHIWarning />
        <textarea
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          rows={5}
          placeholder={`Describe the scenario for Form ${letter}…`}
          className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-1"
          style={{ borderColor: "#CBD5E1" }}
        />

        <button type="button" onClick={() => setShowHeader((v) => !v)} className="text-xs" style={{ color: BRAND }}>
          {showHeader ? "− Hide optional header fields" : "+ Show optional header fields"}
        </button>
        {showHeader && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
            <Field label="Patient Name" value={header.patientName} onChange={(v) => setHeader({ ...header, patientName: v })} />
            <Field label="MRN" value={header.mrn} onChange={(v) => setHeader({ ...header, mrn: v })} />
            <Field label="DOB" value={header.dob} onChange={(v) => setHeader({ ...header, dob: v })} />
            <Field label="Date of Service" value={header.dateOfService} onChange={(v) => setHeader({ ...header, dateOfService: v })} />
            <Field label="Provider" value={header.attendingProvider} onChange={(v) => setHeader({ ...header, attendingProvider: v })} />
            <Field label="Query Author" value={header.queryAuthorName} onChange={(v) => setHeader({ ...header, queryAuthorName: v })} />
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !scenario.trim()}
          className="rounded-md px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: BRAND }}
        >
          {loading ? "Drafting…" : `Draft Form ${letter}`}
        </button>
      </form>

      {err && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {form && (
        <section className="space-y-4">
          <div className="rounded-lg border p-6 shadow-sm bg-white" style={{ borderColor: BRAND }}>
            <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
              <span className="rounded px-2 py-0.5 font-medium text-white" style={{ backgroundColor: BRAND }}>
                Form {form.form_letter}
              </span>
              <span>{form.title}</span>
            </div>

            <p className="mb-4 text-sm italic text-slate-700">{form.summary_line}</p>

            {form.detail_sections.map((s, i) => (
              <div key={i} className="mb-3">
                <div className="text-xs font-semibold" style={{ color: BRAND }}>{s.heading}</div>
                <div className="text-sm text-slate-700">{s.body}</div>
              </div>
            ))}

            <div className="mt-4 rounded-md bg-slate-50 p-3">
              <div className="font-medium text-sm mb-2">{form.question}</div>
              <ul className="space-y-1 text-sm">
                {form.options.map((opt, i) => (
                  <li key={i}>☐ {opt}</li>
                ))}
              </ul>
            </div>

            {form.reason && <p className="mt-3 text-xs italic text-slate-500">Reason: {form.reason}</p>}
          </div>

          <button
            onClick={onExport}
            disabled={exporting}
            className="rounded-md px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: BRAND }}
          >
            {exporting ? "Generating…" : `⬇ Export Form ${form.form_letter} (DOCX)`}
          </button>

          {citations.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Policy references</h3>
              <ol className="space-y-2">
                {citations.map((c) => (
                  <li key={c.n} className="rounded-md border border-indigo-100 bg-indigo-50 p-3 text-xs">
                    <div className="font-medium">[{c.n}] {c.source} · {c.docTitle}</div>
                    <div className="mt-1 italic text-slate-700">&ldquo;{c.excerpt}&rdquo;</div>
                    <Link href={`/api/policies/document/${c.policyDocId}`} className="mt-2 inline-block text-brand-700 hover:underline">
                      ⬇ Download policy (DOCX)
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-0.5 block text-xs font-medium text-slate-600">{label}</label>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
      />
    </div>
  );
}
