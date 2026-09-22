"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { AIOutputDisclaimer, NoPHIWarning } from "@/lib/disclaimers";
import { checkWithConventionRules, type WithConventionRule } from "@/lib/icd10-with-convention-rules";

const BRAND = "#14457B";
const CARD = "#E7ECF4";
const AMBER = "#B45309";
const AMBER_LIGHT = "#FEF3C7";

const SEVERITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  info: { bg: "#E7ECF4", text: "#14457B", label: "Info" },
  review_needed: { bg: "#FEF3C7", text: "#B45309", label: "Review Needed" },
  likely_issue: { bg: "#FEE2E2", text: "#991B1B", label: "Likely Issue" },
};

type Finding = { area: string; concern: string; citation: string; severity: string };
type ValidationResult = {
  summary: string;
  cpt_validation_note: string;
  findings: Finding[];
  not_reviewable: string;
};
type Citation = { n: number; source: string; docTitle: string; sourceUrl: string };

type DocUploadResult = {
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
  suggestedDos?: string | null;
  codeSystem?: "ICD-10" | "HCPCS" | "CPT";
};

type ClaimRow = {
  id: string;
  dosFrom: string;
  dosTo: string;
  ageYears: string;
  ageMonths: string;
  ageDays: string;
  gender: "M" | "F" | "U" | "";
  procedureSupply: string;
  units: string;
  modifiers: string[]; // 4 slots
  diagnosisCodes: string[]; // 8 slots
};

function newRow(): ClaimRow {
  return {
    id: Math.random().toString(36).slice(2),
    dosFrom: "",
    dosTo: "",
    ageYears: "",
    ageMonths: "",
    ageDays: "",
    gender: "",
    procedureSupply: "",
    units: "",
    modifiers: ["", "", "", ""],
    diagnosisCodes: ["", "", "", "", "", "", "", ""],
  };
}

// Builds the natural-language claim description the existing, already-
// tested /api/claim-validation endpoint expects — keeps the backend
// contract unchanged while the frontend now collects structured fields.
function composeClaimDescription(rows: ClaimRow[]): string {
  const parts: string[] = [];
  rows.forEach((row, i) => {
    const bits: string[] = [];
    if (row.dosFrom) bits.push(`DOS ${row.dosFrom}${row.dosTo && row.dosTo !== row.dosFrom ? ` to ${row.dosTo}` : ""}`);
    const age = [row.ageYears && `${row.ageYears}y`, row.ageMonths && `${row.ageMonths}mo`, row.ageDays && `${row.ageDays}d`].filter(Boolean).join(" ");
    if (age) bits.push(`patient age ${age}`);
    if (row.gender) bits.push(`gender ${row.gender === "M" ? "male" : row.gender === "F" ? "female" : "unknown"}`);
    if (row.procedureSupply) bits.push(`procedure/supply code ${row.procedureSupply}${row.units ? ` (${row.units} units)` : ""}`);
    const mods = row.modifiers.filter(Boolean);
    if (mods.length) bits.push(`modifiers ${mods.join(", ")}`);
    const dx = row.diagnosisCodes.filter(Boolean);
    if (dx.length) bits.push(`diagnosis codes ${dx.join(", ")}`);
    if (bits.length) parts.push(`Line ${i + 1}: ${bits.join("; ")}.`);
  });
  return parts.join("\n");
}

function ClaimRowCard({
  row,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  row: ClaimRow;
  index: number;
  onChange: (row: ClaimRow) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  function set<K extends keyof ClaimRow>(key: K, value: ClaimRow[K]) {
    onChange({ ...row, [key]: value });
  }
  function setModifier(i: number, value: string) {
    const mods = [...row.modifiers];
    mods[i] = value.toUpperCase().slice(0, 2);
    set("modifiers", mods);
  }
  function setDiagnosis(i: number, value: string) {
    const dx = [...row.diagnosisCodes];
    dx[i] = value.toUpperCase();
    set("diagnosisCodes", dx);
  }

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: BRAND }}>
      <div className="flex items-center justify-between px-4 py-2 text-white text-sm font-semibold" style={{ backgroundColor: BRAND }}>
        <span>Line {index + 1}</span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-white/80 hover:text-white text-xs">
            ✕ Remove
          </button>
        )}
      </div>
      <div className="p-4 space-y-4 bg-white">
        {/* DOS */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="DOS From" value={row.dosFrom} onChange={(v) => set("dosFrom", v)} type="date" />
          <Field label="DOS To" value={row.dosTo} onChange={(v) => set("dosTo", v)} type="date" />
        </div>

        {/* Age + Gender */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Patient Age</label>
            <div className="grid grid-cols-3 gap-1">
              <input value={row.ageYears} onChange={(e) => set("ageYears", e.target.value)} placeholder="Years" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
              <input value={row.ageMonths} onChange={(e) => set("ageMonths", e.target.value)} placeholder="Months" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
              <input value={row.ageDays} onChange={(e) => set("ageDays", e.target.value)} placeholder="Days" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Patient Gender</label>
            <div className="flex gap-3 pt-1.5">
              {(["M", "F", "U"] as const).map((g) => (
                <label key={g} className="flex items-center gap-1 text-xs text-slate-700">
                  <input type="radio" checked={row.gender === g} onChange={() => set("gender", g)} style={{ accentColor: BRAND }} />
                  {g === "M" ? "Male" : g === "F" ? "Female" : "Unknown"}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Procedure/Supply + Units */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Procedure/Supply Code
              <span className="ml-1 font-normal text-slate-400">(HCPCS — CPT lookup pending AMA license)</span>
            </label>
            <input value={row.procedureSupply} onChange={(e) => set("procedureSupply", e.target.value.toUpperCase())} placeholder="e.g. E0143" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <Field label="Units" value={row.units} onChange={(v) => set("units", v)} type="number" />
        </div>

        {/* Modifiers */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Modifiers</label>
          <div className="grid grid-cols-4 gap-2">
            {row.modifiers.map((m, i) => (
              <input key={i} value={m} onChange={(e) => setModifier(i, e.target.value)} maxLength={2} placeholder="—" className="rounded border border-slate-300 px-2 py-1.5 text-xs text-center" />
            ))}
          </div>
        </div>

        {/* Diagnosis Codes — 2 rows of 4, matching the mockup grid */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Diagnosis Codes (ICD-10)</label>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {row.diagnosisCodes.slice(0, 4).map((d, i) => (
              <input key={i} value={d} onChange={(e) => setDiagnosis(i, e.target.value)} placeholder="—" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {row.diagnosisCodes.slice(4, 8).map((d, i) => (
              <input key={i + 4} value={d} onChange={(e) => setDiagnosis(i + 4, e.target.value)} placeholder="—" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
    </div>
  );
}

type FavoriteCode = { code: string; label: string };
const FAVORITES_KEY = "proedcs-claim-validation-favorites";

function loadFavorites(): FavoriteCode[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveFavorites(favs: FavoriteCode[]) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  } catch {
    // localStorage unavailable — favorites just won't persist, non-fatal
  }
}

export default function ClaimValidationPage() {
  const [rows, setRows] = useState<ClaimRow[]>([newRow()]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [hcpcsLookup, setHcpcsLookup] = useState<Record<string, {
    pricing: { caNonRural: number | null; caRural: number | null; description: string; category: string } | null;
    discontinued: { termDate: string | null; quarter: string } | null;
    mue: { mueValue: number; exceeded: boolean } | null;
  }>>({});
  const [citations, setCitations] = useState<Citation[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<FavoriteCode[]>([]);
  const [newFavCode, setNewFavCode] = useState("");
  const [newFavLabel, setNewFavLabel] = useState("");
  const [showAddFavorite, setShowAddFavorite] = useState(false);

  // Coding guideline check — runs live against every diagnosis code
  // currently in the form, not just at submit time, so the coder sees
  // the flag as soon as both trigger conditions are present.
  const guidelineFlags: WithConventionRule[] = useMemo(() => {
    const allDx = rows.flatMap((r) => r.diagnosisCodes);
    return checkWithConventionRules(allDx);
  }, [rows]);

  // Document upload — merged in from the former standalone Document
  // Upload tab. Reuses the exact same /api/document-upload endpoint,
  // unchanged, just surfaced as a section here instead of its own page.
  const [docCodeSystem, setDocCodeSystem] = useState<"ICD-10" | "HCPCS" | "CPT">("ICD-10");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docResult, setDocResult] = useState<DocUploadResult | null>(null);
  const [docErr, setDocErr] = useState<string | null>(null);
  const [docDragActive, setDocDragActive] = useState(false);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  function addFavorite() {
    const code = newFavCode.trim().toUpperCase();
    if (!code) return;
    const label = newFavLabel.trim();
    const next = [...favorites.filter((f) => f.code !== code), { code, label }];
    setFavorites(next);
    saveFavorites(next);
    setNewFavCode("");
    setNewFavLabel("");
    setShowAddFavorite(false);
  }
  function removeFavorite(code: string) {
    const next = favorites.filter((f) => f.code !== code);
    setFavorites(next);
    saveFavorites(next);
  }
  function useFavorite(code: string) {
    // Fills the most recently added row's Procedure/Supply field — the
    // most predictable target without needing focus-tracking complexity.
    if (rows.length === 0) return;
    const lastIdx = rows.length - 1;
    const updated = { ...rows[lastIdx], procedureSupply: code };
    updateRow(lastIdx, updated);
  }

  function updateRow(i: number, updated: ClaimRow) {
    const next = [...rows];
    next[i] = updated;
    setRows(next);
  }
  function addRow() {
    setRows([...rows, newRow()]);
  }
  function removeRow(i: number) {
    setRows(rows.filter((_, idx) => idx !== i));
  }
  function loadExample() {
    const r = newRow();
    r.dosFrom = "2026-08-15";
    r.dosTo = "2026-08-15";
    r.ageYears = "68";
    r.gender = "F";
    r.procedureSupply = "E0143";
    r.units = "1";
    r.modifiers = ["RT", "", "", ""];
    r.diagnosisCodes = ["I10", "E119", "", "", "", "", "", ""];
    setRows([r]);
  }

  function handleDocFileSelect(f: File | null) {
    setDocFile(f);
    setDocResult(null);
    setDocErr(null);
  }

  function handleDocDrop(e: React.DragEvent) {
    e.preventDefault();
    setDocDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleDocFileSelect(dropped);
  }

  async function onDocAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!docFile) return;
    setDocLoading(true);
    setDocErr(null);
    setDocResult(null);
    try {
      const formData = new FormData();
      formData.append("file", docFile);
      formData.append("codeSystem", docCodeSystem);
      const r = await fetch("/api/document-upload", { method: "POST", body: formData });
      const json = await r.json();
      if (!r.ok) {
        setDocErr(json.raw ? `${json.error} (partial AI output: "${json.raw}")` : (json.error ?? `HTTP ${r.status}`));
      } else {
        setDocResult(json);
      }
    } catch (e: unknown) {
      setDocErr(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setDocLoading(false);
    }
  }

  // Fills the LAST claim row with what the upload found — only codes the
  // AI marked "supported" (never the "possible/needs more documentation"
  // ones, since those aren't confirmed). Only touches empty fields, never
  // overwrites something the user already typed in manually.
  function applyDocResultToForm() {
    if (!docResult) return;
    const supportedCodes = docResult.supported_codes.map((c) => c.code_hint).filter(Boolean);
    const lastIdx = rows.length - 1;
    const updated = { ...rows[lastIdx] };

    if (docResult.suggestedDos && !updated.dosFrom) {
      updated.dosFrom = docResult.suggestedDos;
      if (!updated.dosTo) updated.dosTo = docResult.suggestedDos;
    }

    if (docResult.codeSystem === "ICD-10") {
      const dx = [...updated.diagnosisCodes];
      let fillIdx = 0;
      for (const code of supportedCodes) {
        while (fillIdx < 8 && dx[fillIdx]) fillIdx++;
        if (fillIdx >= 8) break;
        dx[fillIdx] = code;
        fillIdx++;
      }
      updated.diagnosisCodes = dx;
    } else if (docResult.codeSystem === "HCPCS" && !updated.procedureSupply && supportedCodes.length > 0) {
      updated.procedureSupply = supportedCodes[0];
    }

    updateRow(lastIdx, updated);
  }

  async function onValidate(e: React.FormEvent) {
    e.preventDefault();
    const claimDescription = composeClaimDescription(rows);
    if (!claimDescription.trim()) return;
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const codes = rows.map((r) => r.procedureSupply.trim()).filter(Boolean);
      const unitsByCode: Record<string, number> = {};
      for (const r of rows) {
        if (r.procedureSupply.trim()) unitsByCode[r.procedureSupply.trim()] = parseInt(r.units, 10) || 0;
      }
      const [validationRes, lookupRes] = await Promise.all([
        fetch("/api/claim-validation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimDescription }),
        }),
        codes.length > 0
          ? fetch("/api/hcpcs-lookup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ codes, unitsByCode }),
            })
          : Promise.resolve(null),
      ]);

      const json = await validationRes.json();
      if (!validationRes.ok || json.error) {
        setErr(json.error ?? `HTTP ${validationRes.status}`);
      } else {
        setResult(json.result);
        setCitations(json.citations ?? []);
      }

      if (lookupRes) {
        const lookupJson = await lookupRes.json();
        setHcpcsLookup(lookupJson.results ?? {});
      } else {
        setHcpcsLookup({});
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h1 className="text-xl font-bold text-white">Claim Validation</h1>
          <p className="mt-1 text-sm text-white/85">
            Enter claim lines below — DOS, patient demographics, procedure/supply, modifiers, and diagnosis codes.
          </p>
        </div>
      </section>

      <div className="rounded-md border border-amber-300 p-4 text-sm" style={{ backgroundColor: AMBER_LIGHT, color: AMBER }}>
        <b>⚠️ Partial validation — CPT/modifier-pair checks unavailable pending AMA CPT license.</b> This tool validates ICD-10 coding conventions, HCPCS/modifier policy, and general Medicare medical necessity documentation. It never validates CPT code numbers or CPT-modifier combinations until ProEd&apos;s AMA license is active. Real California DMEPOS pricing and discontinued-code warnings are shown for HCPCS supply/equipment codes; CPT procedure pricing still requires a separate AMA-licensed dataset.
      </div>

      <AIOutputDisclaimer />
      <NoPHIWarning />

      {/* Favorite Codes — click a chip to fill the most recent row's Procedure/Supply field */}
      <div className="rounded-lg border p-3" style={{ borderColor: BRAND }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold" style={{ color: BRAND }}>⭐ Favorite Codes</span>
          <button
            type="button"
            onClick={() => setShowAddFavorite((v) => !v)}
            className="text-xs"
            style={{ color: BRAND }}
          >
            {showAddFavorite ? "Cancel" : "+ Add favorite"}
          </button>
        </div>

        {showAddFavorite && (
          <div className="flex flex-wrap gap-2 mb-2">
            <input
              value={newFavCode}
              onChange={(e) => setNewFavCode(e.target.value)}
              placeholder="Code, e.g. E0143"
              className="rounded border border-slate-300 px-2 py-1 text-xs w-32"
            />
            <input
              value={newFavLabel}
              onChange={(e) => setNewFavLabel(e.target.value)}
              placeholder="Label (optional), e.g. Walker"
              className="rounded border border-slate-300 px-2 py-1 text-xs flex-1 min-w-[140px]"
            />
            <button type="button" onClick={addFavorite} className="rounded px-3 py-1 text-xs font-medium text-white" style={{ backgroundColor: BRAND }}>
              Save
            </button>
          </div>
        )}

        {favorites.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No favorites saved yet. Add a code you use often for quick reuse.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {favorites.map((f) => (
              <span
                key={f.code}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                style={{ backgroundColor: CARD, color: BRAND }}
              >
                <button type="button" onClick={() => useFavorite(f.code)} className="font-medium hover:underline">
                  {f.code}{f.label ? ` — ${f.label}` : ""}
                </button>
                <button type="button" onClick={() => removeFavorite(f.code)} className="text-slate-400 hover:text-red-600" aria-label={`Remove ${f.code}`}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15, 23, 42, 0.5)" }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-semibold" style={{ color: BRAND }}>📄 Upload a Document</span>
              <button type="button" onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-700 text-lg leading-none" aria-label="Close">
                ✕
              </button>
            </div>
            <div className="flex gap-2">
              {(["ICD-10", "HCPCS", "CPT"] as const).map((sys) => (
                <button
                  key={sys}
                  type="button"
                  onClick={() => setDocCodeSystem(sys)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium border"
                  style={{
                    borderColor: BRAND,
                    backgroundColor: docCodeSystem === sys ? BRAND : "white",
                    color: docCodeSystem === sys ? "white" : BRAND,
                  }}
                >
                  {sys}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Upload a chart note or medical record (PDF or text) instead of manually entering claim lines — flags likely codes and what documentation is missing to support them.
            </p>

            {docCodeSystem === "CPT" && (
              <div className="rounded-md border border-amber-300 p-2 text-xs" style={{ backgroundColor: AMBER_LIGHT, color: AMBER }}>
                ⚠️ Placeholder mode — pending AMA CPT license. Shows plain-English service categories only, never a specific CPT code number.
              </div>
            )}

            <form onSubmit={onDocAnalyze} className="space-y-2">
              <div
                onDragOver={(e) => { e.preventDefault(); setDocDragActive(true); }}
                onDragLeave={() => setDocDragActive(false)}
                onDrop={handleDocDrop}
                onClick={() => docFileInputRef.current?.click()}
                className="rounded-md border-2 border-dashed px-4 py-6 text-center cursor-pointer transition"
                style={{
                  borderColor: docDragActive ? BRAND : "#CBD5E1",
                  backgroundColor: docDragActive ? CARD : "white",
                }}
              >
                <input
                  ref={docFileInputRef}
                  type="file"
                  accept=".pdf,.txt,text/plain,application/pdf"
                  className="hidden"
                  onChange={(e) => handleDocFileSelect(e.target.files?.[0] ?? null)}
                />
                {docFile ? (
                  <div className="text-sm font-medium text-slate-800">📄 {docFile.name}</div>
                ) : (
                  <div className="text-sm" style={{ color: BRAND }}>Click to upload, or drag and drop a PDF or text file</div>
                )}
              </div>
              <button
                type="submit"
                disabled={docLoading || !docFile}
                className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: BRAND }}
              >
                {docLoading ? "Extracting & analyzing…" : `Check ${docCodeSystem} Documentation`}
              </button>
            </form>

            {docErr && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{docErr}</div>}

            {docResult && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                {docResult.fileName && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                    Extracted {docResult.extractedCharCount?.toLocaleString()} characters from <b>{docResult.fileName}</b>
                    {docResult.truncated && " (long document — analysis based on the first portion)"}
                  </div>
                )}
                {docResult.supported_codes.length > 0 && docResult.codeSystem !== "CPT" && (
                  <button
                    type="button"
                    onClick={() => { applyDocResultToForm(); setShowUploadModal(false); }}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
                    style={{ backgroundColor: BRAND }}
                  >
                    ↓ Apply These Codes to the Claim Form
                  </button>
                )}
                {docResult.overall_note && (
                  <div className="rounded-md border p-2 text-xs" style={{ borderColor: BRAND, backgroundColor: CARD, color: "#14457B" }}>
                    {docResult.overall_note}
                  </div>
                )}
                {docResult.supported_codes.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold mb-1" style={{ color: BRAND }}>✅ Supported by documentation</div>
                    <div className="space-y-1.5">
                      {docResult.supported_codes.map((c, i) => (
                        <div key={i} className="rounded-md border p-2 text-xs" style={{ borderColor: BRAND }}>
                          <div className="font-medium text-slate-900">{c.code_hint} — {c.description}</div>
                          <div className="italic text-slate-600 mt-0.5">&ldquo;{c.evidence}&rdquo;</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {docResult.possible_codes_needing_more_documentation.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold mb-1" style={{ color: AMBER }}>⚠️ Possible — needs more documentation</div>
                    <div className="space-y-1.5">
                      {docResult.possible_codes_needing_more_documentation.map((c, i) => (
                        <div key={i} className="rounded-md border p-2 text-xs" style={{ borderColor: AMBER, backgroundColor: AMBER_LIGHT }}>
                          <div className="font-medium text-slate-900">{c.code_hint} — {c.description}</div>
                          <div className="text-slate-700 mt-0.5">Mentioned: {c.why_flagged}</div>
                          <div className="font-medium mt-0.5" style={{ color: AMBER }}>Documentation needed: {c.documentation_needed}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {guidelineFlags.length > 0 && (
        <div className="space-y-2">
          {guidelineFlags.map((rule) => (
            <div key={rule.id} className="rounded-lg border p-3 text-xs" style={{ borderColor: AMBER, backgroundColor: AMBER_LIGHT, color: "#78350F" }}>
              <div className="font-semibold mb-1" style={{ color: AMBER }}>
                📋 Coding Guideline — {rule.label}
              </div>
              <p>{rule.guidance}</p>
              <p className="mt-1"><b>Consider:</b> {rule.suggestedCodeRange}</p>
              <p className="mt-1 italic text-[10px] opacity-75">{rule.citation} — verify the exact code against current documentation before use.</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={onValidate} className="space-y-4">
        <div className="flex justify-end">
          <button type="button" onClick={loadExample} className="text-xs" style={{ color: BRAND }}>
            Load an example
          </button>
        </div>

        {rows.map((row, i) => (
          <ClaimRowCard
            key={row.id}
            row={row}
            index={i}
            onChange={(updated) => updateRow(i, updated)}
            onRemove={() => removeRow(i)}
            canRemove={rows.length > 1}
          />
        ))}

        <button
          type="button"
          onClick={addRow}
          className="rounded-md px-4 py-2 text-sm font-medium border"
          style={{ borderColor: BRAND, color: BRAND }}
        >
          + Add Line
        </button>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: BRAND }}
          >
            {loading ? "Validating…" : "Validate Claim"}
          </button>
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="rounded-md px-4 py-3 text-sm font-medium border"
            style={{ borderColor: BRAND, color: BRAND, backgroundColor: "white" }}
          >
            📄 Upload Document
          </button>
        </div>
      </form>

      {err && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {result && (
        <section className="space-y-4">
          {/* Scrub Results — echoes each line's entered data, matching the claim-scrubber layout */}
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: BRAND }}>
            <div className="px-4 py-2 text-white text-sm font-semibold" style={{ backgroundColor: BRAND }}>
              Scrub Results
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: CARD }}>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Line</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">DOS</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Procedure/Supply</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Units</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Modifiers</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Diagnosis</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">RVU/Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Conversion Factor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const lookup = hcpcsLookup[row.procedureSupply.trim()];
                  return (
                    <tr key={row.id} className={i % 2 === 0 ? "bg-white" : ""} style={i % 2 !== 0 ? { backgroundColor: "#F8FAFC" } : {}}>
                      <td className="px-3 py-2 font-medium">{i + 1}</td>
                      <td className="px-3 py-2">{row.dosFrom || "—"}</td>
                      <td className="px-3 py-2">
                        {row.procedureSupply || "—"}
                        {lookup?.discontinued && (
                          <span className="ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-red-100 text-red-700" title={`Discontinued effective ${lookup.discontinued.termDate} (${lookup.discontinued.quarter} update)`}>
                            ⚠ Discontinued
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.units || "—"}
                        {lookup?.mue?.exceeded && (
                          <span className="ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-amber-100 text-amber-800" title={`DME Supplier MUE limit for this code is ${lookup.mue.mueValue} unit(s) per date of service`}>
                            ⚠ Exceeds MUE ({lookup.mue.mueValue})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{row.modifiers.filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-3 py-2">{row.diagnosisCodes.filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-3 py-2">
                        {lookup?.pricing ? (
                          <span title={lookup.pricing.description}>
                            ${lookup.pricing.caNonRural?.toFixed(2) ?? "—"} <span className="text-slate-400">(CA, non-rural)</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">{row.procedureSupply ? "No CA fee schedule match" : "—"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-400 italic">Requires CPT-specific fee data</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {Object.values(hcpcsLookup).some((l) => l.discontinued) && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              ⚠ One or more procedure/supply codes entered above were discontinued in a recent CMS quarterly update. Verify the code is still valid for this date of service before submitting.
            </div>
          )}

          {Object.values(hcpcsLookup).some((l) => l.mue?.exceeded) && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              ⚠ One or more lines exceed the DME Supplier Medically Unlikely Edit (MUE) limit for that code — the units entered are unlikely to be reported for a single date of service. Review before submitting; this may trigger a coding denial.
            </div>
          )}

          <div className="rounded-lg border p-5 bg-white" style={{ borderColor: BRAND }}>
            <p className="text-sm text-slate-700">{result.summary}</p>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {result.cpt_validation_note}
          </div>

          {result.findings.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Findings</h2>
              {result.findings.map((f, i) => {
                const style = SEVERITY_STYLE[f.severity] ?? SEVERITY_STYLE.info;
                return (
                  <div key={i} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: style.bg, color: style.text }}>
                        {style.label}
                      </span>
                      <span className="text-xs font-medium text-slate-700">{f.area}</span>
                    </div>
                    <p className="text-sm text-slate-700">{f.concern}</p>
                    <p className="text-xs text-slate-400 mt-1">{f.citation}</p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <b>Not reviewable by this tool:</b> {result.not_reviewable}
          </div>

          {citations.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Sources referenced</h2>
              <ul className="space-y-1 text-xs text-slate-600">
                {citations.map((c) => (
                  <li key={c.n}>[{c.n}] {c.source} — {c.docTitle}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
