"use client";

import { useMemo, useState } from "react";
import { NoPHIWarning } from "@/lib/disclaimers";
import { THEME } from "@/lib/theme";
import {
  PAYER_PROFILES,
  blankClaim,
  blankLine,
  type Cms1500,
  type Issue,
  type PayerId,
  type ServiceLine,
} from "@/lib/cms1500-rules";

type ApiResult = {
  issues: Issue[];
  summary: { errors: number; warnings: number; info: number };
  payer: { id: string; name: string; timelyFilingNote: string };
  effective: { timelyFilingDays: number };
  codeLookupAvailable: boolean;
  cptNote: string;
};

const SEV = {
  error: { bg: "#FEE2E2", fg: "#991B1B", label: "Error" },
  warning: { bg: "#FEF3C7", fg: "#B45309", label: "Warning" },
  info: { bg: THEME.primaryLight, fg: THEME.primary, label: "Info" },
} as const;

const inputCls = "w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2";

function sampleClaim(): Cms1500 {
  const d = new Date();
  d.setDate(d.getDate() - 20);
  const dos = d.toISOString().slice(0, 10);
  return {
    ...blankClaim("medicare-b"),
    box1a: "1EG4TE5MK73", box2: "DOE, JANE A", box3Dob: "1950-03-04", box3Sex: "F",
    box5Address: "123 SAMPLE ST", box5City: "LOS ANGELES", box5State: "CA", box5Zip: "90001",
    box11: "NONE", box21: ["E11.40", "I10"], box25: "12-3456789", box26: "TEST-001",
    box28: 150, box31SignedDate: dos, box33Name: "SAMPLE PRACTICE", box33Npi: "1234567893",
    lines: [{ dosFrom: dos, dosTo: dos, pos: "11", emg: false, procedure: "99214", modifiers: ["25"], dxPointers: "AB", charges: 150, units: 1, renderingNpi: "1234567893" }],
  };
}

export default function Cms1500ValidationPage() {
  const [claim, setClaim] = useState<Cms1500>(() => blankClaim("medicare-b"));
  const [tfOverride, setTfOverride] = useState("");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const set = <K extends keyof Cms1500>(k: K, v: Cms1500[K]) => setClaim((c) => ({ ...c, [k]: v }));
  const setLine = (i: number, patch: Partial<ServiceLine>) =>
    setClaim((c) => ({ ...c, lines: c.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const setDx = (i: number, v: string) =>
    setClaim((c) => ({ ...c, box21: c.box21.map((d, j) => (j === i ? v.toUpperCase() : d)) }));

  const lineSum = useMemo(() => Math.round(claim.lines.reduce((s, l) => s + (l.charges || 0) * 100, 0)) / 100, [claim.lines]);
  const payer = PAYER_PROFILES[claim.payerId];

  // Issue boxes look like "21B", "24D (line 2)", "1a" — highlight fields by prefix.
  const flagged = useMemo(() => {
    const m = new Map<string, "error" | "warning">();
    for (const i of result?.issues ?? []) {
      if (i.severity === "info") continue;
      const key = i.box.toLowerCase();
      const cur = m.get(key);
      if (!cur || i.severity === "error") m.set(key, i.severity);
    }
    return m;
  }, [result]);
  const sevFor = (box: string, line?: number) => {
    const b = box.toLowerCase();
    let s: "error" | "warning" | undefined;
    flagged.forEach((v, k) => {
      const hit = line != null ? k === `${b} (line ${line + 1})` : k === b || (b.length > 1 && k.startsWith(b) && !/\d/.test(k.slice(b.length, b.length + 1)) && !k.includes("(line"));
      if (hit && (!s || v === "error")) s = v;
    });
    return s;
  };
  const ring = (box: string, line?: number) => {
    const s = sevFor(box, line);
    return s === "error" ? { borderColor: "#DC2626", background: "#FEF2F2" } : s === "warning" ? { borderColor: "#D97706", background: "#FFFBEB" } : undefined;
  };

  function changePayer(id: PayerId) {
    setClaim((c) => ({
      ...c,
      payerId: id,
      box1: id === "medi-cal" || id === "medicaid-other" ? "MEDICAID" : id === "medicare-b" ? "MEDICARE" : c.box1 === "MEDICARE" || c.box1 === "MEDICAID" ? "GROUP" : c.box1,
    }));
    setResult(null);
  }

  async function validate() {
    setLoading(true);
    setErr("");
    try {
      const body = {
        claim: { ...claim, box28: Number.isFinite(claim.box28) ? claim.box28 : 0, box29: Number.isFinite(claim.box29) ? claim.box29 : 0 },
        overrides: tfOverride.trim() ? { timelyFilingDays: parseInt(tfOverride, 10) } : undefined,
      };
      const res = await fetch("/api/cms-1500-validation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Validation failed");
      setResult(j as ApiResult);
      setTimeout(() => document.getElementById("cms-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setLoading(false);
    }
  }

  const Box = ({ n, title, children, span = "" }: { n: string; title: string; children: React.ReactNode; span?: string }) => (
    <div className={`border border-red-200 bg-white p-2 ${span}`}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#B91C1C" }}>
        <span className="mr-1 rounded bg-red-50 px-1">{n}</span>{title}
      </div>
      {children}
    </div>
  );
  const Check = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <label className="mr-3 inline-flex items-center gap-1 text-sm"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>
  );

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="mb-4 rounded-lg p-4" style={{ background: THEME.primary }}>
        <h1 className="text-xl font-bold text-white">Claim Validation</h1>
        <p className="text-sm text-gray-200">Enter the claim exactly as it appears on the CMS-1500 (02/12) form, pick the payer, and validate against that payer&apos;s rules before submission.</p>
      </div>
      <NoPHIWarning />

      {/* Payer */}
      <div className="mb-4 grid gap-3 rounded-lg border bg-white p-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-gray-600">PAYER RULE PROFILE</label>
          <select className={inputCls} value={claim.payerId} onChange={(e) => changePayer(e.target.value as PayerId)}>
            {Object.values(PAYER_PROFILES).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-600">{payer.timelyFilingNote}</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">TIMELY FILING OVERRIDE (days, optional)</label>
          <input className={inputCls} inputMode="numeric" placeholder={`Default ${payer.timelyFilingDays}`} value={tfOverride} onChange={(e) => setTfOverride(e.target.value.replace(/\D/g, ""))} />
          <p className="mt-1 text-xs text-gray-500">Use the limit in the specific payer contract.</p>
        </div>
      </div>

      {/* Form */}
      <div className="grid gap-px bg-red-200 md:grid-cols-6">
        <Box n="1" title="Type of coverage" span="md:col-span-2">
          <select className={inputCls} style={ring("1")} value={claim.box1} onChange={(e) => set("box1", e.target.value as Cms1500["box1"])}>
            {["MEDICARE", "MEDICAID", "TRICARE", "CHAMPVA", "GROUP", "FECA", "OTHER"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Box>
        <Box n="1a" title="Insured's ID number" span="md:col-span-2">
          <input className={inputCls} style={ring("1a")} value={claim.box1a} onChange={(e) => set("box1a", e.target.value.toUpperCase())} />
        </Box>
        <Box n="26" title="Patient account no." span="md:col-span-2">
          <input className={inputCls} style={ring("26")} value={claim.box26} onChange={(e) => set("box26", e.target.value)} />
        </Box>

        <Box n="2" title="Patient name (Last, First MI)" span="md:col-span-3">
          <input className={inputCls} style={ring("2")} value={claim.box2} onChange={(e) => set("box2", e.target.value.toUpperCase())} />
        </Box>
        <Box n="3" title="Patient DOB / Sex" span="md:col-span-3">
          <div className="flex gap-2">
            <input type="date" className={inputCls} style={ring("3")} value={claim.box3Dob} onChange={(e) => set("box3Dob", e.target.value)} />
            <select className={inputCls} style={ring("3")} value={claim.box3Sex} onChange={(e) => set("box3Sex", e.target.value as Cms1500["box3Sex"])}>
              <option value="">Sex…</option><option value="M">M</option><option value="F">F</option><option value="X">X</option>
            </select>
          </div>
        </Box>

        <Box n="4" title="Insured's name" span="md:col-span-3">
          <input className={inputCls} style={ring("4")} value={claim.box4} onChange={(e) => set("box4", e.target.value.toUpperCase())} />
        </Box>
        <Box n="6" title="Patient relationship to insured" span="md:col-span-3">
          <select className={inputCls} style={ring("6")} value={claim.box6} onChange={(e) => set("box6", e.target.value as Cms1500["box6"])}>
            <option value="">Select…</option><option value="SELF">Self</option><option value="SPOUSE">Spouse</option><option value="CHILD">Child</option><option value="OTHER">Other</option>
          </select>
        </Box>

        <Box n="5" title="Patient address / city / state / ZIP" span="md:col-span-6">
          <div className="grid gap-2 md:grid-cols-6">
            <input className={`${inputCls} md:col-span-3`} placeholder="Street" style={ring("5")} value={claim.box5Address} onChange={(e) => set("box5Address", e.target.value.toUpperCase())} />
            <input className={`${inputCls} md:col-span-1`} placeholder="City" style={ring("5")} value={claim.box5City} onChange={(e) => set("box5City", e.target.value.toUpperCase())} />
            <input className={inputCls} placeholder="ST" maxLength={2} style={ring("5")} value={claim.box5State} onChange={(e) => set("box5State", e.target.value.toUpperCase())} />
            <input className={inputCls} placeholder="ZIP" maxLength={10} style={ring("5")} value={claim.box5Zip} onChange={(e) => set("box5Zip", e.target.value)} />
          </div>
        </Box>

        <Box n="10" title="Condition related to" span="md:col-span-3">
          <Check checked={claim.box10a} onChange={(v) => set("box10a", v)} label="10a Employment" />
          <Check checked={claim.box10b} onChange={(v) => set("box10b", v)} label="10b Auto accident" />
          <Check checked={claim.box10c} onChange={(v) => set("box10c", v)} label="10c Other accident" />
          {claim.box10b && <input className={`${inputCls} mt-1 w-24`} placeholder="State" maxLength={2} style={ring("10b")} value={claim.box10bState} onChange={(e) => set("box10bState", e.target.value.toUpperCase())} />}
        </Box>
        <Box n="11" title="Insured's policy / group no. (NONE if n/a)" span="md:col-span-3">
          <input className={inputCls} style={ring("11")} value={claim.box11} onChange={(e) => set("box11", e.target.value.toUpperCase())} />
          <div className="mt-1"><Check checked={claim.box11d} onChange={(v) => set("box11d", v)} label="11d Another health benefit plan?" /></div>
        </Box>

        <Box n="12 / 13" title="Signatures on file" span="md:col-span-3">
          <Check checked={claim.box12SignedOnFile} onChange={(v) => set("box12SignedOnFile", v)} label="12 Patient (SOF)" />
          <Check checked={claim.box13SignedOnFile} onChange={(v) => set("box13SignedOnFile", v)} label="13 Insured (SOF)" />
        </Box>
        <Box n="14" title="Date of current illness / injury" span="md:col-span-3">
          <input type="date" className={inputCls} style={ring("14")} value={claim.box14Date} onChange={(e) => set("box14Date", e.target.value)} />
        </Box>

        <Box n="17 / 17b" title="Referring / ordering provider" span="md:col-span-6">
          <div className="grid gap-2 md:grid-cols-6">
            <select className={inputCls} style={ring("17")} value={claim.box17Qualifier} onChange={(e) => set("box17Qualifier", e.target.value as Cms1500["box17Qualifier"])}>
              <option value="">Qualifier…</option><option value="DN">DN Referring</option><option value="DK">DK Ordering</option><option value="DQ">DQ Supervising</option>
            </select>
            <input className={`${inputCls} md:col-span-3`} placeholder="Name" style={ring("17")} value={claim.box17Name} onChange={(e) => set("box17Name", e.target.value.toUpperCase())} />
            <input className={`${inputCls} md:col-span-2`} placeholder="17b NPI" maxLength={10} style={ring("17b")} value={claim.box17bNpi} onChange={(e) => set("box17bNpi", e.target.value.replace(/\D/g, ""))} />
          </div>
        </Box>

        <Box n="21" title="Diagnosis codes (ICD-10-CM) A–L — ICD Ind. 0" span="md:col-span-6">
          <div className="mb-2 flex items-center gap-3">
            <select className={`${inputCls} w-40`} style={ring("21")} value={claim.box21Icd} onChange={(e) => set("box21Icd", e.target.value as Cms1500["box21Icd"])}>
              <option value="0">ICD Ind. 0 (ICD-10)</option><option value="9">ICD Ind. 9 (ICD-9)</option><option value="">None</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            {claim.box21.map((d, i) => {
              const L = String.fromCharCode(65 + i);
              return (
                <div key={i} className="flex items-center gap-1">
                  <span className="w-4 text-xs font-bold text-gray-500">{L}</span>
                  <input className={inputCls} style={ring(`21${L}`)} placeholder="E11.40" value={d} onChange={(e) => setDx(i, e.target.value)} />
                  {claim.box21.length > 1 && <button type="button" className="text-xs text-red-600" onClick={() => set("box21", claim.box21.filter((_, j) => j !== i))} aria-label={`Remove ${L}`}>✕</button>}
                </div>
              );
            })}
          </div>
          {claim.box21.length < 12 && <button type="button" className="mt-2 text-sm font-semibold" style={{ color: THEME.primary }} onClick={() => set("box21", [...claim.box21, ""])}>+ Add diagnosis</button>}
        </Box>

        <Box n="22 / 23" title="Resubmission code · Original ref no. · Prior authorization" span="md:col-span-6">
          <div className="grid gap-2 md:grid-cols-3">
            <select className={inputCls} style={ring("22")} value={claim.box22Code} onChange={(e) => set("box22Code", e.target.value)}>
              <option value="">22 Resubmission: none (original)</option><option value="1">1 – Original</option><option value="7">7 – Replacement</option><option value="8">8 – Void</option>
            </select>
            <input className={inputCls} placeholder="22 Original ref. no. (ICN/DCN)" style={ring("22")} value={claim.box22OrigRef} onChange={(e) => set("box22OrigRef", e.target.value)} />
            <input className={inputCls} placeholder="23 Prior authorization no." style={ring("23")} value={claim.box23} onChange={(e) => set("box23", e.target.value)} />
          </div>
        </Box>

        {/* Box 24 */}
        <Box n="24" title="Service lines (max 6)" span="md:col-span-6">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-gray-500">
                  <th>#</th><th>24A From</th><th>To</th><th>24B POS</th><th>24C EMG</th><th>24D CPT/HCPCS</th><th>Modifiers (≤4)</th><th>24E Dx ptr</th><th>24F $ Charges</th><th>24G Units</th><th>24J Rendering NPI</th><th />
                </tr>
              </thead>
              <tbody>
                {claim.lines.map((l, i) => (
                  <tr key={i} className="align-top">
                    <td className="pr-1 pt-1 font-bold text-gray-500">{i + 1}</td>
                    <td className="pr-1"><input type="date" className={inputCls} style={ring("24A", i)} value={l.dosFrom} onChange={(e) => setLine(i, { dosFrom: e.target.value, dosTo: l.dosTo && l.dosTo >= e.target.value ? l.dosTo : e.target.value })} /></td>
                    <td className="pr-1"><input type="date" className={inputCls} style={ring("24A", i)} value={l.dosTo} onChange={(e) => setLine(i, { dosTo: e.target.value })} /></td>
                    <td className="pr-1 w-16"><input className={inputCls} maxLength={2} style={ring("24B", i)} value={l.pos} onChange={(e) => setLine(i, { pos: e.target.value.replace(/\D/g, "") })} /></td>
                    <td className="pr-1 text-center"><input type="checkbox" checked={l.emg} onChange={(e) => setLine(i, { emg: e.target.checked })} /></td>
                    <td className="pr-1 w-28"><input className={inputCls} maxLength={5} style={ring("24D", i)} value={l.procedure} onChange={(e) => setLine(i, { procedure: e.target.value.toUpperCase() })} /></td>
                    <td className="pr-1 w-36"><input className={inputCls} placeholder="25, 59" style={ring("24D", i)} value={l.modifiers.join(",")} onChange={(e) => setLine(i, { modifiers: e.target.value.toUpperCase().split(/[,\s]+/).filter(Boolean) })} /></td>
                    <td className="pr-1 w-20"><input className={inputCls} maxLength={4} placeholder="AB" style={ring("24E", i)} value={l.dxPointers} onChange={(e) => setLine(i, { dxPointers: e.target.value.toUpperCase().replace(/[^A-L]/g, "") })} /></td>
                    <td className="pr-1 w-28"><input type="number" min={0} step="0.01" className={inputCls} style={ring("24F", i)} value={l.charges || ""} onChange={(e) => setLine(i, { charges: parseFloat(e.target.value) || 0 })} /></td>
                    <td className="pr-1 w-20"><input type="number" min={1} className={inputCls} style={ring("24G", i)} value={l.units} onChange={(e) => setLine(i, { units: parseInt(e.target.value, 10) || 0 })} /></td>
                    <td className="pr-1 w-32"><input className={inputCls} maxLength={10} style={ring("24J", i)} value={l.renderingNpi} onChange={(e) => setLine(i, { renderingNpi: e.target.value.replace(/\D/g, "") })} /></td>
                    <td>{claim.lines.length > 1 && <button type="button" className="px-1 text-red-600" onClick={() => set("lines", claim.lines.filter((_, j) => j !== i))} aria-label={`Remove line ${i + 1}`}>✕</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {claim.lines.length < 6 && <button type="button" className="mt-2 text-sm font-semibold" style={{ color: THEME.primary }} onClick={() => set("lines", [...claim.lines, { ...blankLine(), dosFrom: claim.lines[claim.lines.length - 1]?.dosFrom ?? "", dosTo: claim.lines[claim.lines.length - 1]?.dosTo ?? "" }])}>+ Add service line</button>}
        </Box>

        <Box n="25" title="Federal tax ID" span="md:col-span-2">
          <div className="flex gap-2">
            <input className={inputCls} placeholder="12-3456789" style={ring("25")} value={claim.box25} onChange={(e) => set("box25", e.target.value)} />
            <select className={`${inputCls} w-20`} value={claim.box25Type} onChange={(e) => set("box25Type", e.target.value as "EIN" | "SSN")}><option>EIN</option><option>SSN</option></select>
          </div>
        </Box>
        <Box n="27" title="Accept assignment?" span="md:col-span-1">
          <Check checked={claim.box27AcceptAssignment} onChange={(v) => set("box27AcceptAssignment", v)} label="Yes" />
        </Box>
        <Box n="28" title={`Total charge (lines total $${lineSum.toFixed(2)})`} span="md:col-span-2">
          <div className="flex gap-2">
            <input type="number" step="0.01" min={0} className={inputCls} style={ring("28")} value={claim.box28 || ""} onChange={(e) => set("box28", parseFloat(e.target.value) || 0)} />
            <button type="button" className="whitespace-nowrap rounded border px-2 text-xs" onClick={() => set("box28", lineSum)}>Use sum</button>
          </div>
        </Box>
        <Box n="29" title="Amount paid" span="md:col-span-1">
          <input type="number" step="0.01" min={0} className={inputCls} style={ring("29")} value={claim.box29 || ""} onChange={(e) => set("box29", parseFloat(e.target.value) || 0)} />
        </Box>

        <Box n="31" title="Physician signature date" span="md:col-span-2">
          <input type="date" className={inputCls} style={ring("31")} value={claim.box31SignedDate} onChange={(e) => set("box31SignedDate", e.target.value)} />
        </Box>
        <Box n="32 / 32a" title="Service facility · NPI" span="md:col-span-2">
          <input className={inputCls} placeholder="Name / address" style={ring("32")} value={claim.box32Name} onChange={(e) => set("box32Name", e.target.value.toUpperCase())} />
          <input className={`${inputCls} mt-1`} placeholder="32a NPI" maxLength={10} style={ring("32a")} value={claim.box32Npi} onChange={(e) => set("box32Npi", e.target.value.replace(/\D/g, ""))} />
        </Box>
        <Box n="33 / 33a" title="Billing provider · NPI" span="md:col-span-2">
          <input className={inputCls} placeholder="Name / address" style={ring("33")} value={claim.box33Name} onChange={(e) => set("box33Name", e.target.value.toUpperCase())} />
          <input className={`${inputCls} mt-1`} placeholder="33a NPI" maxLength={10} style={ring("33a")} value={claim.box33Npi} onChange={(e) => set("box33Npi", e.target.value.replace(/\D/g, ""))} />
        </Box>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={validate} disabled={loading} className="rounded px-5 py-2 font-semibold text-white disabled:opacity-60" style={{ background: THEME.primary }}>
          {loading ? "Validating…" : "Validate Claim"}
        </button>
        <button type="button" className="rounded border px-4 py-2 text-sm" onClick={() => { setClaim(sampleClaim()); setResult(null); }}>Load sample claim</button>
        <button type="button" className="rounded border px-4 py-2 text-sm" onClick={() => { setClaim(blankClaim(claim.payerId)); setResult(null); setErr(""); }}>Clear form</button>
      </div>
      {err && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{err}</p>}

      {result && (
        <div id="cms-results" className="mt-6 rounded-lg border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold" style={{ color: THEME.primary }}>
              {result.summary.errors === 0 ? "✓ No blocking errors" : `✗ ${result.summary.errors} error${result.summary.errors > 1 ? "s" : ""} to fix before submission`}
            </h2>
            <span className="rounded px-2 py-0.5 text-xs font-semibold" style={{ background: SEV.error.bg, color: SEV.error.fg }}>{result.summary.errors} errors</span>
            <span className="rounded px-2 py-0.5 text-xs font-semibold" style={{ background: SEV.warning.bg, color: SEV.warning.fg }}>{result.summary.warnings} warnings</span>
            <span className="rounded px-2 py-0.5 text-xs font-semibold" style={{ background: SEV.info.bg, color: SEV.info.fg }}>{result.summary.info} info</span>
          </div>
          <p className="mb-3 text-xs text-gray-600">Validated against: <b>{result.payer.name}</b> · timely filing limit {result.effective.timelyFilingDays} days.</p>
          {!result.codeLookupAvailable && <p className="mb-3 rounded bg-amber-50 p-2 text-sm text-amber-800">Code tables could not be reached — diagnosis/HCPCS existence, discontinued and MUE checks were skipped.</p>}
          <ul className="space-y-2">
            {result.issues.map((i, k) => {
              const s = SEV[i.severity];
              return (
                <li key={k} className="rounded border-l-4 p-2 text-sm" style={{ background: s.bg, borderColor: s.fg, color: "#111827" }}>
                  <span className="mr-2 rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ background: s.fg, color: "#fff" }}>{s.label}</span>
                  <span className="mr-2 font-mono text-xs font-bold">Box {i.box}</span>
                  {i.message}
                  {i.fix && <div className="mt-1 text-xs text-gray-700"><b>Fix:</b> {i.fix}</div>}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-gray-500">{result.cptNote} This tool screens claims against general payer rules and built-in defaults; it does not guarantee payment. Confirm against the payer&apos;s current provider manual and contract.</p>
        </div>
      )}
    </div>
  );
}
