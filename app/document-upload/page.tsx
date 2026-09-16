"use client";

import { useState, useRef } from "react";
import { AIOutputDisclaimer, NoPHIWarning } from "@/lib/disclaimers";

const TEAL = "#14457B";
const TEAL_LIGHT = "#E7ECF4";
const TEAL_DARK = "#14457B";
const AMBER = "#B45309";
const AMBER_LIGHT = "#FEF3C7";

type CheckResult = {
  supported_codes: { code_hint: string; description: string; evidence: string }[];
  possible_codes_needing_more_documentation: {
    code_hint: string;
    description: string;
    why_flagged: string;
    documentation_needed: string;
  }[];
  overall_note: string;
  extractedTextPreview?: string;
  extractedCharCount?: number;
  truncated?: boolean;
  fileName?: string;
};

export default function DocumentUploadPage() {
  const [codeSystem, setCodeSystem] = useState<"ICD-10" | "HCPCS" | "CPT">("ICD-10");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(f: File | null) {
    setFile(f);
    setResult(null);
    setErr(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFileSelect(dropped);
  }

  async function onAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("codeSystem", codeSystem);
      const r = await fetch("/api/document-upload", { method: "POST", body: formData });
      const json = await r.json();
      if (!r.ok) {
        setErr(json.raw ? `${json.error} (partial AI output: "${json.raw}")` : (json.error ?? `HTTP ${r.status}`));
      } else {
        setResult(json);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3" style={{ backgroundColor: TEAL }}>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white leading-snug">Document Upload</h1>
            <p className="mt-1 text-sm text-white/85">
              Upload a chart note or medical record (PDF or text) — flags likely codes and what documentation is missing to support them
            </p>
          </div>
          <div className="rounded-md bg-white/95 px-4 py-2 text-center shadow-sm">
            <div className="font-serif italic text-lg leading-none" style={{ color: TEAL_DARK }}>proed</div>
            <div className="text-[9px] uppercase tracking-wide text-slate-500 mt-0.5">Consulting · Staffing · Scanning</div>
          </div>
        </div>
      </section>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <b>This tool suggests candidates for your review — it never confirms a code is billable.</b> Final coding judgment is always yours. This reads the document you upload; it does not connect to any EHR system.
      </div>

      <AIOutputDisclaimer />

      {codeSystem === "CPT" && (
        <div className="rounded-md border border-amber-300 p-3 text-xs" style={{ backgroundColor: AMBER_LIGHT, color: AMBER }}>
          <b>⚠️ Placeholder mode — pending AMA CPT license.</b> This mode will never show a specific CPT code number, only plain-English service categories, until ProEd&apos;s AMA license is active and real code data is integrated.
        </div>
      )}

      <form onSubmit={onAnalyze} className="space-y-3">
        <div className="flex gap-2">
          {(["ICD-10", "HCPCS", "CPT"] as const).map((sys) => (
            <button
              key={sys}
              type="button"
              onClick={() => setCodeSystem(sys)}
              className="rounded-md px-4 py-2 text-sm font-medium border"
              style={{
                borderColor: TEAL,
                backgroundColor: codeSystem === sys ? TEAL : "white",
                color: codeSystem === sys ? "white" : TEAL_DARK,
              }}
            >
              {sys}
            </button>
          ))}
        </div>

        <NoPHIWarning />

        {/* Drag-and-drop upload zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border-2 border-dashed px-6 py-10 text-center cursor-pointer transition"
          style={{
            borderColor: dragActive ? TEAL : "#CBD5E1",
            backgroundColor: dragActive ? TEAL_LIGHT : "white",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,text/plain,application/pdf"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div>
              <div className="text-sm font-medium text-slate-800">📄 {file.name}</div>
              <div className="text-xs text-slate-500 mt-1">Click or drop a different file to replace it</div>
            </div>
          ) : (
            <div>
              <div className="text-sm font-medium" style={{ color: TEAL_DARK }}>Click to upload, or drag and drop</div>
              <div className="text-xs text-slate-500 mt-1">PDF or plain text (.txt) files</div>
            </div>
          )}
        </div>

        <div>
          <button
            type="submit"
            disabled={loading || !file}
            className="rounded-md px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: TEAL }}
          >
            {loading ? "Extracting & analyzing…" : `Check ${codeSystem} Documentation`}
          </button>
        </div>
      </form>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      )}

      {result && (
        <div className="space-y-5">
          {result.fileName && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Extracted {result.extractedCharCount?.toLocaleString()} characters from <b>{result.fileName}</b>
              {result.truncated && " (document was long — analysis based on the first portion)"}
            </div>
          )}

          {result.overall_note && (
            <div className="rounded-md border p-3 text-sm" style={{ borderColor: TEAL, backgroundColor: TEAL_LIGHT, color: TEAL_DARK }}>
              {result.overall_note}
            </div>
          )}

          {result.supported_codes.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold" style={{ color: TEAL_DARK }}>
                ✅ Supported by documentation
              </h2>
              <div className="space-y-2">
                {result.supported_codes.map((c, i) => (
                  <div key={i} className="rounded-md border p-3" style={{ borderColor: TEAL }}>
                    <div className="font-medium text-sm text-slate-900">{c.code_hint} — {c.description}</div>
                    <div className="text-xs italic text-slate-600 mt-1">&ldquo;{c.evidence}&rdquo;</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.possible_codes_needing_more_documentation.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold" style={{ color: AMBER }}>
                ⚠️ Possible — needs more documentation
              </h2>
              <div className="space-y-2">
                {result.possible_codes_needing_more_documentation.map((c, i) => (
                  <div key={i} className="rounded-md border p-3" style={{ borderColor: AMBER, backgroundColor: AMBER_LIGHT }}>
                    <div className="font-medium text-sm text-slate-900">{c.code_hint} — {c.description}</div>
                    <div className="text-xs text-slate-700 mt-1">Mentioned: {c.why_flagged}</div>
                    <div className="text-xs font-medium mt-1" style={{ color: AMBER }}>
                      Documentation needed: {c.documentation_needed}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.supported_codes.length === 0 && result.possible_codes_needing_more_documentation.length === 0 && (
            <p className="text-sm text-slate-500">No clear code candidates identified — try a more detailed document.</p>
          )}
        </div>
      )}
    </div>
  );
}
