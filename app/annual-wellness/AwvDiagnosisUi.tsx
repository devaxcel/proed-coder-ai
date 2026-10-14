"use client";

import { useState } from "react";
import Icd10Combo from "@/app/components/Icd10Combo";
import { MODIFIERS } from "@/lib/modifier-data";
import { THEME } from "@/lib/theme";

const TEAL = THEME.primary;
const TEAL_LIGHT = THEME.primaryLight;

export type Dx = { code: string; description: string };
export type ProcLine = {
  id: string;
  procedure: string; // CPT/HCPCS code or free description
  mod1: string;
  mod2: string;
  units: number;
  detail: string;
  dxLinks: string[]; // codes from the patient's diagnosis list
  necessity: boolean;
};

export const MAX_PROC_LINES = 10;
export const newProcLine = (): ProcLine => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  procedure: "", mod1: "", mod2: "", units: 1, detail: "", dxLinks: [], necessity: false,
});
export const hasProcContent = (l: ProcLine) => !!(l.procedure.trim() || l.detail.trim());

const letter = (i: number) => String.fromCharCode(65 + i);

/** Turn a procedure/lab line into an export row (same shape as the other AWV export items). */
export function procLineToExportItem(l: ProcLine, sectionTitle: string) {
  const m = l.procedure.trim().match(/^([A-Za-z0-9]{5})\b\s*(.*)$/);
  const code = m ? m[1].toUpperCase() : "OTHER PROCEDURE";
  const text = (m ? m[2] : l.procedure.trim()) || "Additional procedure / lab";
  const parts = [text];
  if (l.detail.trim()) parts.push(l.detail.trim());
  const mods = [l.mod1, l.mod2].filter(Boolean);
  if (mods.length) parts.push(`Modifier${mods.length > 1 ? "s" : ""}: ${mods.join(", ")}`);
  if (l.units > 1) parts.push(`Units: ${l.units}`);
  if (l.necessity) parts.push("Medical necessity documented");
  return { sectionTitle, code, description: parts.join(" · "), dx: l.dxLinks.join(", ") };
}

/** Clickable diagnosis chips (A · E11.22) + optional "add" search box. */
export function DxChips({
  dx, linked, onToggle, onAdd, addLabel = "Add diagnosis (search ICD-10 code or term)",
}: {
  dx: Dx[];
  linked: string[];
  onToggle: (code: string) => void;
  onAdd: (d: Dx) => void;
  addLabel?: string;
}) {
  return (
    <div className="space-y-2">
      {dx.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {dx.map((d, i) => {
            const on = linked.includes(d.code);
            return (
              <button
                key={d.code}
                type="button"
                title={d.description}
                onClick={() => onToggle(d.code)}
                className="rounded-full border px-3 py-1 text-xs font-medium transition"
                style={{ borderColor: on ? TEAL : "#CBD5E1", background: on ? TEAL : "white", color: on ? "white" : "#1F2937" }}
              >
                {letter(i)} · {d.code}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-500">No patient diagnoses yet — search below to add one.</p>
      )}
      <AddDx label={addLabel} onAdd={onAdd} />
    </div>
  );
}

function AddDx({ label, onAdd }: { label: string; onAdd: (d: Dx) => void }) {
  const [text, setText] = useState("");
  return (
    <Icd10Combo
      label={label}
      labelColor="#475569"
      value={text}
      onChange={setText}
      placeholder="e.g., E11.22 or diabetes with CKD"
      onPick={(p) => { onAdd({ code: p.code, description: p.description }); setText(""); }}
    />
  );
}

/** Patient-level diagnosis list (the pool the chips draw from). */
export function PatientDiagnoses({ dx, onAdd, onRemove }: { dx: Dx[]; onAdd: (d: Dx) => void; onRemove: (code: string) => void }) {
  return (
    <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: TEAL_LIGHT, backgroundColor: TEAL_LIGHT }}>
      <div className="text-xs font-bold" style={{ color: TEAL }}>Patient Diagnoses</div>
      <p className="text-xs text-slate-600">
        Search the ICD-10 code table and Alphabetic Index. Diagnoses added here (or inside any measure below) become selectable chips for each measure and each additional procedure/lab.
      </p>
      <AddDx label="Add diagnosis (ICD-10 code or term)" onAdd={onAdd} />
      {dx.length > 0 && (
        <ul className="space-y-1">
          {dx.map((d, i) => (
            <li key={d.code} className="flex items-start gap-2 rounded border border-slate-200 bg-white px-2 py-1 text-xs">
              <span className="font-bold" style={{ color: TEAL }}>{letter(i)} · {d.code}</span>
              <span className="flex-1 text-slate-600">{d.description}</span>
              <button type="button" onClick={() => onRemove(d.code)} className="text-red-600" aria-label={`Remove ${d.code}`}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Per-measure diagnosis row. */
export function SectionDiagnoses({ dx, linked, onToggle, onAdd }: { dx: Dx[]; linked: string[]; onToggle: (c: string) => void; onAdd: (d: Dx) => void }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Diagnoses for this measure</div>
      <DxChips dx={dx} linked={linked} onToggle={onToggle} onAdd={onAdd} addLabel="Add diagnosis" />
    </div>
  );
}

/** Additional In-Office Procedures & Labs — CPT/HCPCS, modifiers, units, detail, linked dx, necessity. */
export function ProcedureLines({
  lines, setLines, dx, onAddDx,
}: {
  lines: ProcLine[];
  setLines: (fn: (prev: ProcLine[]) => ProcLine[]) => void;
  dx: Dx[];
  onAddDx: (d: Dx) => void;
}) {
  const patch = (id: string, p: Partial<ProcLine>) => setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const inputCls = "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm";
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold" style={{ color: TEAL }}>Additional In-Office Procedures &amp; Labs (not listed below)</div>
      {lines.map((l, i) => (
        <div key={l.id} className="space-y-2 rounded-md border bg-white p-3" style={{ borderColor: TEAL }}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold">CPT / HCPCS {i + 1}{l.procedure.trim() ? ` · ${l.procedure.trim().split(/\s+/)[0].toUpperCase()}` : ""}</div>
            {lines.length > 1 && (
              <button type="button" className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700" onClick={() => setLines((p) => p.filter((x) => x.id !== l.id))}>Remove</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-12">
            <div className="col-span-2 md:col-span-4">
              <label className="mb-0.5 block text-xs text-slate-600">CPT / HCPCS (code or description)</label>
              <input className={inputCls} value={l.procedure} onChange={(e) => patch(l.id, { procedure: e.target.value })} placeholder="e.g., 93000 or ECG with interpretation" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-0.5 block text-xs text-slate-600">Modifier 1</label>
              <select className={inputCls} value={l.mod1} onChange={(e) => patch(l.id, { mod1: e.target.value })}>
                <option value="">None</option>
                {MODIFIERS.map((m) => <option key={m.code} value={m.code}>{m.code} — {m.description}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-0.5 block text-xs text-slate-600">Modifier 2</label>
              <select className={inputCls} value={l.mod2} onChange={(e) => patch(l.id, { mod2: e.target.value })}>
                <option value="">None</option>
                {MODIFIERS.map((m) => <option key={m.code} value={m.code}>{m.code} — {m.description}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="mb-0.5 block text-xs text-slate-600">Units</label>
              <input type="number" min={1} className={inputCls} value={l.units} onChange={(e) => patch(l.id, { units: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="mb-0.5 block text-xs text-slate-600">Detail (optional)</label>
              <input className={inputCls} value={l.detail} onChange={(e) => patch(l.id, { detail: e.target.value })} placeholder="e.g., GAD-7, PHQ-9" />
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-600">Linked diagnoses</div>
            <DxChips
              dx={dx}
              linked={l.dxLinks}
              onToggle={(c) => patch(l.id, { dxLinks: l.dxLinks.includes(c) ? l.dxLinks.filter((x) => x !== c) : [...l.dxLinks, c] })}
              onAdd={(d) => { onAddDx(d); patch(l.id, { dxLinks: l.dxLinks.includes(d.code) ? l.dxLinks : [...l.dxLinks, d.code] }); }}
            />
          </div>
          <label className="flex items-center justify-end gap-2 text-sm">
            <input type="checkbox" checked={l.necessity} onChange={(e) => patch(l.id, { necessity: e.target.checked })} />
            Medical necessity documented
          </label>
        </div>
      ))}
      {lines.length < MAX_PROC_LINES && (
        <button type="button" className="text-sm font-semibold" style={{ color: TEAL }} onClick={() => setLines((p) => [...p, newProcLine()])}>
          + Add procedure / lab
        </button>
      )}
    </div>
  );
}
