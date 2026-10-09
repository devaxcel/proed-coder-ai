"use client";

import { useState } from "react";
import {
  AWV_MEASURE_SECTIONS,
  type MeasureItem,
  type MeasureGroup,
  type MeasureSection,
  lookupBmiDxCodes,
  bmiToMipsIndex,
  systolicToIndex,
  diastolicToIndex,
  hba1cToIndex,
  ldlToIndex,
  nephropathyToIndex,
  isAfterStudySection,
} from "@/lib/awv-measures-data";
import { THEME } from "@/lib/theme";

const TEAL = THEME.primary;
const TEAL_LIGHT = THEME.primaryLight;
const TEAL_DARK = THEME.primary;
const AMBER = "#B45309";
const AMBER_LIGHT = "#FEF3C7";

// Selection state is keyed by a fully-unique per-rendered-item id, so
// clicking a code in one section never affects the same code number
// appearing in a different section (e.g. 4016F shows up in both Pain
// Assessments and Osteoarthritis, but they're tracked independently).
type SelectionKey = string;
function itemKey(sectionKey: string, groupIdx: number, itemIdx: number): SelectionKey {
  return `${sectionKey}::${groupIdx}::${itemIdx}`;
}

// Checklist options for the Colorectal screening "type of screening"
// requirement — matches the methods named in the section's own note.
const COLORECTAL_TYPES = [
  { id: "colonoscopy10", label: "Colonoscopy (every 10 years)" },
  { id: "fit-fobt", label: "FOBT or FIT (annual)" },
  { id: "stool-dna", label: "Stool DNA test (every 3 years)" },
  { id: "high-risk-colonoscopy2", label: "High-risk: Colonoscopy (every 2 years)" },
];

type ExportItem = { sectionTitle: string; code: string; description: string; dx: string };
type SavedAwvPatient = { id: string; patientName: string; accountNumber: string; dos: string; items: ExportItem[] };

// Which code click requires a gating / informational popup before the
// chip can be selected. Centralized here so handleItemClick stays a
// simple lookup rather than a pile of inline string comparisons.
type ModalState =
  | { kind: "acp"; sectionKey: string; groupIdx: number; itemIdx: number; groupSize: number }
  | { kind: "fallLow"; sectionKey: string; groupIdx: number; itemIdx: number; groupSize: number }
  | { kind: "fallHigh"; sectionKey: string; groupIdx: number; itemIdx: number; groupSize: number }
  | { kind: "foot"; sectionKey: string; groupIdx: number; itemIdx: number; groupSize: number; code: string }
  | { kind: "depressionInfo"; sectionKey: string; groupIdx: number; itemIdx: number; groupSize: number };

function CodeChip({
  item,
  selected,
  note,
  onClick,
}: {
  item: MeasureItem;
  selected: boolean;
  note?: string;
  onClick: () => void;
}) {
  const isMips = item.description.startsWith("MIPS — ");
  return (
    <button
      type="button"
      onClick={onClick}
      title={item.note}
      className="w-full text-left rounded-md border px-3 py-2 text-xs transition"
      style={{
        borderColor: selected ? TEAL : "#E2E8F0",
        backgroundColor: selected ? TEAL : "white",
        color: selected ? "white" : "#1F2937",
      }}
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-bold">{item.code}</span>
        <span
          className="rounded px-1 py-0.5 text-[9px] font-medium"
          style={{
            backgroundColor: selected ? "rgba(255,255,255,0.2)" : TEAL_LIGHT,
            color: selected ? "white" : TEAL_DARK,
          }}
        >
          {item.status}
        </span>
        {isMips && (
          <span
            className="rounded px-1 py-0.5 text-[9px] font-bold"
            style={{
              backgroundColor: selected ? "rgba(255,255,255,0.25)" : "#D4AF37",
              color: selected ? "white" : "#3A2F0B",
            }}
          >
            MIPS
          </span>
        )}
        {item.dx && (
          <span className="text-[10px] opacity-80">{item.dx}</span>
        )}
      </div>
      <div className={selected ? "text-white/90 mt-0.5" : "text-slate-600 mt-0.5"}>
        {item.description}
      </div>
      {note && (
        <div className={selected ? "text-white/80 mt-1 text-[10px] italic" : "text-slate-500 mt-1 text-[10px] italic"}>
          ✓ {note}
        </div>
      )}
    </button>
  );
}

export default function AwvMeasuresPanel() {
  const [selected, setSelected] = useState<Record<SelectionKey, boolean>>({});
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [patientName, setPatientName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [dos, setDos] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  // Notes captured from gating/confirmation popups, keyed by the same
  // itemKey as the selection they belong to. Folded into the exported
  // description so the documentation detail survives into the DOCX.
  const [confirmNotes, setConfirmNotes] = useState<Record<SelectionKey, string>>({});

  // Active gating/info popup, if any. Re-clicking a code that needs one
  // of these opens it instead of selecting immediately.
  const [modal, setModal] = useState<ModalState | null>(null);
  const [depressionInfoSeen, setDepressionInfoSeen] = useState(false);

  // Advance Care Planning (99497-33) modal fields
  const [mWishSigned, setMWishSigned] = useState(false);
  const [mDecisionMaker, setMDecisionMaker] = useState<"yes" | "no" | "">("");

  // Fall Risk modal fields
  const [mFallChoice, setMFallChoice] = useState<"no-falls" | "one-fall" | "">("");
  const [mFallHighAck, setMFallHighAck] = useState(false);

  // Diabetic foot exam modal fields
  const [mFootVisual, setMFootVisual] = useState(false);
  const [mFootMonofilament, setMFootMonofilament] = useState(false);
  const [mFootOther, setMFootOther] = useState(false);
  const [mFootPulse, setMFootPulse] = useState(false);

  function closeModal() {
    setModal(null);
    setMWishSigned(false);
    setMDecisionMaker("");
    setMFallChoice("");
    setMFallHighAck(false);
    setMFootVisual(false);
    setMFootMonofilament(false);
    setMFootOther(false);
    setMFootPulse(false);
  }

  // After Study sections — date of report on file + confirmation checkbox.
  const [afterStudyReports, setAfterStudyReports] = useState<Record<string, { date: string; onFile: boolean }>>({});
  function setAfterStudyDate(sectionKey: string, date: string) {
    setAfterStudyReports((prev) => ({ ...prev, [sectionKey]: { date, onFile: prev[sectionKey]?.onFile ?? false } }));
  }
  function setAfterStudyOnFile(sectionKey: string, onFile: boolean) {
    setAfterStudyReports((prev) => ({ ...prev, [sectionKey]: { date: prev[sectionKey]?.date ?? "", onFile } }));
  }

  // Colorectal screening — type checkboxes + completion date.
  const [colorectalTypes, setColorectalTypes] = useState<Record<string, boolean>>({});
  const [colorectalDate, setColorectalDate] = useState("");

  // In-Office Procedures — free-text boxes for anything not already listed.
  const [otherProcedures, setOtherProcedures] = useState<string[]>(["", "", "", "", ""]);

  // Multi-patient batch — mirrors the MEAT HCC / E&M tool save-case pattern.
  const [savedPatients, setSavedPatients] = useState<SavedAwvPatient[]>([]);
  const [batchExporting, setBatchExporting] = useState(false);
  const [batchErr, setBatchErr] = useState<string | null>(null);

  // BMI numeric input — auto-computes Z68.x/E66.x diagnosis codes AND
  // auto-selects the matching MIPS chip (group index 1 in the "bmi"
  // section), per Lupita's request to merge the old BMI lookup in here.
  const [bmiInput, setBmiInput] = useState("");
  const bmiValue = parseFloat(bmiInput);
  const bmiDxResult = !isNaN(bmiValue) && bmiValue > 0 ? lookupBmiDxCodes(bmiValue) : null;

  function onBmiInputChange(value: string) {
    setBmiInput(value);
    const n = parseFloat(value);
    const idx = bmiToMipsIndex(n);
    if (idx !== null) {
      selectSingle("bmi", 1, idx, 4);
    }
  }

  // Blood Pressure numeric inputs — same auto-select pattern, for the
  // Systolic (group 0) and Diastolic (group 1) groups independently.
  const [systolicInput, setSystolicInput] = useState("");
  const [diastolicInput, setDiastolicInput] = useState("");

  function onSystolicChange(value: string) {
    setSystolicInput(value);
    const idx = systolicToIndex(parseFloat(value));
    if (idx !== null) selectSingle("blood-pressure", 0, idx, 3);
  }
  function onDiastolicChange(value: string) {
    setDiastolicInput(value);
    const idx = diastolicToIndex(parseFloat(value));
    if (idx !== null) selectSingle("blood-pressure", 1, idx, 3);
  }

  // HbA1c numeric input — same auto-select pattern, for the "HbA1c level"
  // group (group 0) in the "glycemic-status" section.
  const [hba1cInput, setHba1cInput] = useState("");
  function onHba1cChange(value: string) {
    setHba1cInput(value);
    const idx = hba1cToIndex(parseFloat(value));
    if (idx !== null) selectSingle("glycemic-status", 0, idx, 4);
  }

  // LDL numeric input — same auto-select pattern, for the "LDL result"
  // group (group 0) in the "ldl" section.
  const [ldlInput, setLdlInput] = useState("");
  function onLdlChange(value: string) {
    setLdlInput(value);
    const idx = ldlToIndex(parseFloat(value));
    if (idx !== null) selectSingle("ldl", 0, idx, 3);
  }

  // Nephropathy (urine microalbumin) numeric input — same auto-select
  // pattern, for the "Microalbuminuria result" group (group 0) in the
  // "nephropathy" section. New calculator per explicit request, mirroring
  // the BMI/BP/HbA1c/LDL lookups exactly.
  const [nephroInput, setNephroInput] = useState("");
  function onNephroChange(value: string) {
    setNephroInput(value);
    const idx = nephropathyToIndex(parseFloat(value));
    if (idx !== null) selectSingle("nephropathy", 0, idx, 3);
  }

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectSingle(sectionKey: string, groupIdx: number, itemIdx: number, groupSize: number) {
    setSelected((prev) => {
      const next = { ...prev };
      // Clear every other item in this same single-select group first —
      // radio-button behavior, only one choice per group.
      for (let i = 0; i < groupSize; i++) {
        delete next[itemKey(sectionKey, groupIdx, i)];
      }
      next[itemKey(sectionKey, groupIdx, itemIdx)] = true;
      return next;
    });
  }

  function toggleChecklist(sectionKey: string, groupIdx: number, itemIdx: number) {
    const key = itemKey(sectionKey, groupIdx, itemIdx);
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // Central click handler for every code chip in every section. Fixes the
  // "can't unclick a measure clicked by accident" bug (re-clicking an
  // already-selected chip always clears it, for both single-select and
  // checklist groups) and gates specific codes behind confirmation or
  // informational popups before they can be selected for the first time.
  function handleItemClick(section: MeasureSection, group: MeasureGroup, gi: number, ii: number) {
    const item = group.items[ii];
    const groupSize = group.items.length;
    const key = itemKey(section.key, gi, ii);
    const alreadySelected = !!selected[key];

    if (alreadySelected) {
      if (group.type === "single-select") {
        setSelected((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } else {
        toggleChecklist(section.key, gi, ii);
      }
      setConfirmNotes((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    // Advance Care Planning — must confirm the wish form is signed/dated
    // with the patient's name, and whether a decision maker was named,
    // before the measure can be closed.
    if (item.code === "99497-33") {
      setModal({ kind: "acp", sectionKey: section.key, groupIdx: gi, itemIdx: ii, groupSize });
      return;
    }

    // Fall Risk — 1101F covers BOTH "no falls" and "one fall without
    // injury"; ask which one applies and record it for documentation.
    if (item.code === "1101F") {
      setModal({ kind: "fallLow", sectionKey: section.key, groupIdx: gi, itemIdx: ii, groupSize });
      return;
    }
    // Fall Risk — 1100F (2+ falls): remind that documentation must state
    // the medical provider's assessment of risk of death within the year.
    if (item.code === "1100F") {
      setModal({ kind: "fallHigh", sectionKey: section.key, groupIdx: gi, itemIdx: ii, groupSize });
      return;
    }

    // Diabetic foot exam — confirm which exam components were documented
    // before allowing selection.
    if (item.code === "G9226" || item.code === "2028F") {
      setModal({ kind: "foot", sectionKey: section.key, groupIdx: gi, itemIdx: ii, groupSize, code: item.code });
      return;
    }

    // Depression screening — one-time, non-blocking info popup reminding
    // staff that complete documentation needs 3 codes for Medicare
    // patients. Shown once per session, then clicks proceed normally.
    if ((item.code === "G0444" || item.code === "3725F") && !depressionInfoSeen) {
      setModal({ kind: "depressionInfo", sectionKey: section.key, groupIdx: gi, itemIdx: ii, groupSize });
      return;
    }

    if (group.type === "single-select") selectSingle(section.key, gi, ii, groupSize);
    else toggleChecklist(section.key, gi, ii);
  }

  function confirmAcp() {
    if (!modal || modal.kind !== "acp") return;
    if (!mWishSigned || !mDecisionMaker) return; // both required — "otherwise they can't close the measure"
    const key = itemKey(modal.sectionKey, modal.groupIdx, modal.itemIdx);
    setConfirmNotes((prev) => ({
      ...prev,
      [key]: `Wish form signed & dated with patient name: Confirmed. Patient able to name a decision maker: ${mDecisionMaker === "yes" ? "Yes" : "No"}.`,
    }));
    toggleChecklist(modal.sectionKey, modal.groupIdx, modal.itemIdx);
    closeModal();
  }

  function confirmFallLow() {
    if (!modal || modal.kind !== "fallLow") return;
    if (!mFallChoice) return;
    const key = itemKey(modal.sectionKey, modal.groupIdx, modal.itemIdx);
    setConfirmNotes((prev) => ({
      ...prev,
      [key]:
        mFallChoice === "no-falls"
          ? "Documentation reflects: no falls in the past year."
          : "Documentation reflects: one fall in the past year, without injury.",
    }));
    selectSingle(modal.sectionKey, modal.groupIdx, modal.itemIdx, modal.groupSize);
    closeModal();
  }

  function confirmFallHigh() {
    if (!modal || modal.kind !== "fallHigh") return;
    if (!mFallHighAck) return;
    const key = itemKey(modal.sectionKey, modal.groupIdx, modal.itemIdx);
    setConfirmNotes((prev) => ({
      ...prev,
      [key]: "Documentation confirmed: medical provider's assessment of substantial risk of death within the year is recorded.",
    }));
    selectSingle(modal.sectionKey, modal.groupIdx, modal.itemIdx, modal.groupSize);
    closeModal();
  }

  function confirmFoot() {
    if (!modal || modal.kind !== "foot") return;
    const parts: string[] = [];
    if (mFootVisual) parts.push("visual inspection");
    if (mFootMonofilament) parts.push("10-g monofilament sensory exam");
    if (mFootOther) parts.push("128-Hz tuning fork / pinprick / ankle reflex / vibration perception");
    if (mFootPulse) parts.push("pulse exam");
    if (parts.length === 0) return; // require at least one component confirmed
    const key = itemKey(modal.sectionKey, modal.groupIdx, modal.itemIdx);
    setConfirmNotes((prev) => ({ ...prev, [key]: `Foot exam components documented: ${parts.join(", ")}.` }));
    toggleChecklist(modal.sectionKey, modal.groupIdx, modal.itemIdx);
    closeModal();
  }

  function confirmDepressionInfo() {
    if (!modal || modal.kind !== "depressionInfo") return;
    setDepressionInfoSeen(true);
    toggleChecklist(modal.sectionKey, modal.groupIdx, modal.itemIdx);
    closeModal();
  }

  const filteredSections = query.trim()
    ? AWV_MEASURE_SECTIONS.filter((s) => {
        const q = query.toLowerCase();
        if (s.title.toLowerCase().includes(q)) return true;
        return s.groups.some((g) => g.items.some((i) => i.code.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)));
      })
    : AWV_MEASURE_SECTIONS;

  // The actual list of everything currently selected, across every
  // section — this is what "clicking a code" is FOR: it builds this
  // list, which you can review below and export as a document. Any
  // confirmation-popup note gets folded into the description so it
  // survives into the exported document.
  const selectedList: ExportItem[] = [];
  for (const section of AWV_MEASURE_SECTIONS) {
    section.groups.forEach((group, gi) => {
      group.items.forEach((item, ii) => {
        const key = itemKey(section.key, gi, ii);
        if (selected[key]) {
          const note = confirmNotes[key];
          selectedList.push({
            sectionTitle: section.title,
            code: item.code,
            description: note ? `${item.description} — ${note}` : item.description,
            dx: item.dx ?? "",
          });
        }
      });
    });
  }
  const totalSelected = selectedList.length;

  // Full reference — every code in every section, with a selected flag,
  // for the "export the whole page" request distinct from "export just
  // what I clicked."
  type FullRefItem = { sectionTitle: string; code: string; description: string; dx: string; isSelected: boolean };
  const fullReferenceList: FullRefItem[] = [];
  for (const section of AWV_MEASURE_SECTIONS) {
    section.groups.forEach((group, gi) => {
      group.items.forEach((item, ii) => {
        fullReferenceList.push({
          sectionTitle: section.title,
          code: item.code,
          description: item.description,
          dx: item.dx ?? "",
          isSelected: !!selected[itemKey(section.key, gi, ii)],
        });
      });
    });
  }

  // Builds the full export list: every selected chip (with confirmation
  // notes folded in) PLUS the synthetic documentation entries from the
  // After Study report-on-file blocks, the Colorectal screening-type
  // picker, and the In-Office Procedures free-text boxes. Used for both
  // the single-patient export and when saving a patient into the batch.
  function buildExportItems(): ExportItem[] {
    const items: ExportItem[] = [...selectedList];

    for (const section of AWV_MEASURE_SECTIONS) {
      if (isAfterStudySection(section.title)) {
        const rep = afterStudyReports[section.key];
        if (rep && (rep.date || rep.onFile)) {
          items.push({
            sectionTitle: section.title,
            code: "REPORT ON FILE",
            description: `Date of report on file: ${rep.date || "____________"}. Report on file: ${rep.onFile ? "Yes" : "No"}.`,
            dx: "",
          });
        }
      }
      if (section.key === "colorectal") {
        const chosen = COLORECTAL_TYPES.filter((t) => colorectalTypes[t.id]).map((t) => t.label);
        if (chosen.length > 0 || colorectalDate) {
          items.push({
            sectionTitle: section.title,
            code: "SCREENING TYPE",
            description: `Screening type: ${chosen.length ? chosen.join(", ") : "____________"}. Test completion date: ${colorectalDate || "____________"}.`,
            dx: "",
          });
        }
      }
      if (section.key === "in-office-procedures") {
        otherProcedures.forEach((text) => {
          if (text.trim()) {
            items.push({ sectionTitle: section.title, code: "OTHER PROCEDURE", description: text.trim(), dx: "" });
          }
        });
      }
    }
    return items;
  }

  function resetPatientForm() {
    setSelected({});
    setConfirmNotes({});
    setPatientName("");
    setAccountNumber("");
    setDos("");
    setAfterStudyReports({});
    setColorectalTypes({});
    setColorectalDate("");
    setOtherProcedures(["", "", "", "", ""]);
    setBmiInput("");
    setSystolicInput("");
    setDiastolicInput("");
    setHba1cInput("");
    setLdlInput("");
    setNephroInput("");
  }

  function onSaveCase() {
    const items = buildExportItems();
    if (items.length === 0) {
      setExportErr("Nothing selected yet — select at least one code before saving this patient.");
      return;
    }
    setExportErr(null);
    setSavedPatients((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, patientName, accountNumber, dos, items },
    ]);
    resetPatientForm();
  }

  function onRemoveSavedCase(id: string) {
    setSavedPatients((prev) => prev.filter((c) => c.id !== id));
  }

  async function onExportFullReference() {
    setExporting(true);
    setExportErr(null);
    try {
      const r = await fetch("/api/annual-wellness/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientName, accountNumber, dos, items: fullReferenceList, fullReference: true }),
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        setExportErr(json.error ?? "Export failed");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ProEdCS-AWV-Full-Reference-${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setExportErr(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function onExport() {
    const items = buildExportItems();
    if (items.length === 0) return;
    setExporting(true);
    setExportErr(null);
    try {
      const r = await fetch("/api/annual-wellness/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientName, accountNumber, dos, items }),
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        setExportErr(json.error ?? "Export failed");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ProEdCS-AWV-Measures-${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setExportErr(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function onExportBatch() {
    if (savedPatients.length === 0) return;
    setBatchExporting(true);
    setBatchErr(null);
    try {
      const r = await fetch("/api/annual-wellness/export-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patients: savedPatients }),
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        setBatchErr(json.error ?? "Export failed");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ProEdCS-AWV-Batch-${savedPatients.length}-Patients-${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setBatchErr(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBatchExporting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-bold" style={{ color: TEAL_DARK }}>
          Quality Measures — All {AWV_MEASURE_SECTIONS.length} Sections
        </h2>
        <div className="flex items-center gap-2">
          {savedPatients.length > 0 && (
            <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: "#D4AF37", color: "#3A2F0B" }}>
              {savedPatients.length} patient{savedPatients.length !== 1 ? "s" : ""} saved
            </span>
          )}
          {totalSelected > 0 && (
            <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: TEAL }}>
              {totalSelected} code{totalSelected !== 1 ? "s" : ""} selected
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Click a code below to mark it as applicable for this visit — clicking builds the summary list at the bottom of this panel, which you can then export as a document. Click a selected code again to unclick it.
      </p>

      {/* Patient context for the export — same pattern as MEAT HCC */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg border p-3" style={{ borderColor: TEAL_LIGHT, backgroundColor: TEAL_LIGHT }}>
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Patient Name</label>
          <input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Last, First" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Account Number</label>
          <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="MRN / Account #" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Date of Service</label>
          <input type="date" value={dos} onChange={(e) => setDos(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter sections by name or code…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onExportFullReference}
          disabled={exporting}
          className="rounded-md px-4 py-2 text-xs font-medium border disabled:opacity-50"
          style={{ borderColor: TEAL, color: TEAL }}
        >
          {exporting ? "Generating…" : "⬇ Export Full Reference (All Codes, Every Section)"}
        </button>
        <button
          type="button"
          onClick={onSaveCase}
          className="rounded-md px-4 py-2 text-xs font-medium border"
          style={{ borderColor: "#D4AF37", color: "#8A6D1A" }}
        >
          ＋ Save Patient &amp; Start Next
        </button>
        {savedPatients.length > 0 && (
          <button
            type="button"
            onClick={onExportBatch}
            disabled={batchExporting}
            className="rounded-md px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "#D4AF37", color: "#3A2F0B" }}
          >
            {batchExporting ? "Generating…" : `⬇ Export All Saved Patients (${savedPatients.length})`}
          </button>
        )}
      </div>
      {exportErr && <p className="text-xs text-red-600">{exportErr}</p>}
      {batchErr && <p className="text-xs text-red-600">{batchErr}</p>}

      {/* Saved patients list — mirrors MEAT HCC / E&M tool batch pattern */}
      {savedPatients.length > 0 && (
        <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: "#D4AF37", backgroundColor: "#F7F0DC" }}>
          <h3 className="text-xs font-bold" style={{ color: "#8A6D1A" }}>Saved Patients — Pending Batch Export</h3>
          {savedPatients.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-xs">
              <span>
                <b>{c.patientName || "Unnamed patient"}</b>
                {c.accountNumber ? ` — ${c.accountNumber}` : ""}
                {c.dos ? ` — DOS ${c.dos}` : ""}
                <span className="text-slate-400"> — {c.items.length} item{c.items.length !== 1 ? "s" : ""}</span>
              </span>
              <button type="button" onClick={() => onRemoveSavedCase(c.id)} className="text-red-500 hover:underline">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {filteredSections.map((section) => {
          const isOpen = openSections.has(section.key) || !!query.trim();
          const sectionSelectedCount = section.groups.reduce(
            (sum, g, gi) => sum + g.items.reduce((s2, _, ii) => s2 + (selected[itemKey(section.key, gi, ii)] ? 1 : 0), 0),
            0
          );
          return (
            <div key={section.key} className="rounded-lg border overflow-hidden" style={{ borderColor: TEAL }}>
              <button
                type="button"
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                style={{ backgroundColor: TEAL }}
              >
                <div>
                  <div className="text-sm font-semibold text-white">{section.title}</div>
                  {section.populationNote && <div className="text-[11px] text-white/75 mt-0.5">{section.populationNote}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {sectionSelectedCount > 0 && (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">{sectionSelectedCount}</span>
                  )}
                  <span className={`text-white transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                </div>
              </button>

              {isOpen && (
                <div className="p-4 space-y-3 bg-white">
                  {section.sectionNote && (
                    <div className="rounded-md border border-amber-300 p-2 text-xs" style={{ backgroundColor: AMBER_LIGHT, color: AMBER }}>
                      {section.sectionNote}
                    </div>
                  )}

                  {/* After Study sections — date of report on file +
                      confirmation checkbox, per explicit request to add
                      this to every "(After Study)" section. */}
                  {isAfterStudySection(section.title) && (
                    <div className="rounded-md border p-3 grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ borderColor: "#D4AF37", backgroundColor: "#F7F0DC" }}>
                      <div>
                        <label className="block text-xs font-bold mb-1" style={{ color: "#8A6D1A" }}>Date of Report on File</label>
                        <input
                          type="date"
                          value={afterStudyReports[section.key]?.date ?? ""}
                          onChange={(e) => setAfterStudyDate(section.key, e.target.value)}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs font-medium pt-5" style={{ color: "#8A6D1A" }}>
                        <input
                          type="checkbox"
                          checked={afterStudyReports[section.key]?.onFile ?? false}
                          onChange={(e) => setAfterStudyOnFile(section.key, e.target.checked)}
                        />
                        Report is on file
                      </label>
                    </div>
                  )}

                  {/* BMI numeric lookup — merged in from the old standalone
                      BMI section per Lupita's request. Entering a value
                      shows the Z68.x/E66.x diagnosis codes AND
                      auto-selects the matching MIPS chip below. */}
                  {section.key === "bmi" && (
                    <div className="rounded-md border p-3" style={{ borderColor: TEAL, backgroundColor: TEAL_LIGHT }}>
                      <label className="block text-xs font-bold mb-1" style={{ color: TEAL_DARK }}>Enter Patient BMI Value</label>
                      <input
                        type="number"
                        step="0.1"
                        value={bmiInput}
                        onChange={(e) => onBmiInputChange(e.target.value)}
                        placeholder="e.g., 30"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm w-32"
                      />
                      {bmiDxResult && (
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="rounded-md border border-slate-200 bg-white p-2">
                            <div className="text-[10px] font-semibold text-slate-500">BMI diagnosis code (Z68.x)</div>
                            {bmiDxResult.z ? (
                              <div className="text-sm"><b style={{ color: TEAL_DARK }}>{bmiDxResult.z.code}</b> — {bmiDxResult.z.category} ({bmiDxResult.z.label})</div>
                            ) : <div className="text-xs text-slate-400">Out of table range</div>}
                          </div>
                          <div className="rounded-md border border-slate-200 bg-white p-2">
                            <div className="text-[10px] font-semibold text-slate-500">Companion obesity code (E66.x), if clinically documented</div>
                            {bmiDxResult.e ? (
                              <div className="text-sm"><b>{bmiDxResult.e.code}</b> — {bmiDxResult.e.label}</div>
                            ) : <div className="text-xs text-slate-400">Not applicable at this BMI</div>}
                          </div>
                        </div>
                      )}
                      <p className="mt-2 text-[10px] text-slate-500">
                        Pair a Z-code with an E66.x code only when obesity is clinically documented by the provider — never assign E66.x from the BMI value alone.
                      </p>
                    </div>
                  )}

                  {/* Blood Pressure numeric lookup — same auto-select pattern */}
                  {section.key === "blood-pressure" && (
                    <div className="rounded-md border p-3 grid grid-cols-2 gap-3" style={{ borderColor: TEAL, backgroundColor: TEAL_LIGHT }}>
                      <div>
                        <label className="block text-xs font-bold mb-1" style={{ color: TEAL_DARK }}>Systolic (mmHg)</label>
                        <input
                          type="number"
                          value={systolicInput}
                          onChange={(e) => onSystolicChange(e.target.value)}
                          placeholder="e.g., 128"
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1" style={{ color: TEAL_DARK }}>Diastolic (mmHg)</label>
                        <input
                          type="number"
                          value={diastolicInput}
                          onChange={(e) => onDiastolicChange(e.target.value)}
                          placeholder="e.g., 82"
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm w-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* HbA1c numeric lookup — same auto-select pattern as BMI/BP */}
                  {section.key === "glycemic-status" && (
                    <div className="rounded-md border p-3" style={{ borderColor: TEAL, backgroundColor: TEAL_LIGHT }}>
                      <label className="block text-xs font-bold mb-1" style={{ color: TEAL_DARK }}>Enter HbA1c Lab Value (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={hba1cInput}
                        onChange={(e) => onHba1cChange(e.target.value)}
                        placeholder="e.g., 7.5"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm w-32"
                      />
                    </div>
                  )}

                  {/* LDL numeric lookup — same auto-select pattern as BMI/BP */}
                  {section.key === "ldl" && (
                    <div className="rounded-md border p-3" style={{ borderColor: TEAL, backgroundColor: TEAL_LIGHT }}>
                      <label className="block text-xs font-bold mb-1" style={{ color: TEAL_DARK }}>Enter LDL Lab Value (mg/dL)</label>
                      <input
                        type="number"
                        step="1"
                        value={ldlInput}
                        onChange={(e) => onLdlChange(e.target.value)}
                        placeholder="e.g., 115"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm w-32"
                      />
                    </div>
                  )}

                  {/* Nephropathy (urine microalbumin) numeric lookup — new
                      calculator, same auto-select pattern as the other labs. */}
                  {section.key === "nephropathy" && (
                    <div className="rounded-md border p-3" style={{ borderColor: TEAL, backgroundColor: TEAL_LIGHT }}>
                      <label className="block text-xs font-bold mb-1" style={{ color: TEAL_DARK }}>Enter Urine Microalbumin/Creatinine Ratio (mg/g)</label>
                      <input
                        type="number"
                        step="1"
                        value={nephroInput}
                        onChange={(e) => onNephroChange(e.target.value)}
                        placeholder="e.g., 45"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm w-32"
                      />
                    </div>
                  )}

                  {/* Colorectal screening — type checkboxes + completion date */}
                  {section.key === "colorectal" && (
                    <div className="rounded-md border p-3 space-y-2" style={{ borderColor: TEAL, backgroundColor: TEAL_LIGHT }}>
                      <label className="block text-xs font-bold mb-1" style={{ color: TEAL_DARK }}>Type of Screening Performed</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {COLORECTAL_TYPES.map((t) => (
                          <label key={t.id} className="flex items-center gap-2 text-xs bg-white rounded-md px-2 py-1.5 border border-slate-200">
                            <input
                              type="checkbox"
                              checked={!!colorectalTypes[t.id]}
                              onChange={(e) => setColorectalTypes((prev) => ({ ...prev, [t.id]: e.target.checked }))}
                            />
                            {t.label}
                          </label>
                        ))}
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1" style={{ color: TEAL_DARK }}>Date of Test Completion</label>
                        <input
                          type="date"
                          value={colorectalDate}
                          onChange={(e) => setColorectalDate(e.target.value)}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* In-Office Procedures — free-text boxes for anything not
                      already listed below. */}
                  {section.key === "in-office-procedures" && (
                    <div className="rounded-md border p-3 space-y-2" style={{ borderColor: TEAL, backgroundColor: TEAL_LIGHT }}>
                      <label className="block text-xs font-bold mb-1" style={{ color: TEAL_DARK }}>Other Procedures Not Listed Below</label>
                      {otherProcedures.map((val, i) => (
                        <input
                          key={i}
                          value={val}
                          onChange={(e) =>
                            setOtherProcedures((prev) => {
                              const next = [...prev];
                              next[i] = e.target.value;
                              return next;
                            })
                          }
                          placeholder={`Other procedure ${i + 1}…`}
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      ))}
                    </div>
                  )}

                  {section.groups.map((group, gi) => (
                    <div key={gi}>
                      {group.type === "single-select" && group.label && (
                        <div
                          className={
                            section.key === "blood-pressure"
                              ? "text-xs font-bold uppercase tracking-wide mb-1.5"
                              : "text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5"
                          }
                          style={section.key === "blood-pressure" ? { color: TEAL_DARK } : undefined}
                        >
                          {group.label} — select one
                        </div>
                      )}
                      {group.type === "checklist" && group.label && (
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                          {group.label}
                        </div>
                      )}
                      <div className={group.type === "single-select" ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "grid grid-cols-1 sm:grid-cols-2 gap-2"}>
                        {group.items.map((item, ii) => {
                          const key = itemKey(section.key, gi, ii);
                          const isSelected = !!selected[key];
                          return (
                            <CodeChip
                              key={key}
                              item={item}
                              selected={isSelected}
                              note={confirmNotes[key]}
                              onClick={() => handleItemClick(section, group, gi, ii)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filteredSections.length === 0 && (
          <p className="text-sm text-slate-500">No sections match &ldquo;{query}&rdquo;.</p>
        )}
      </div>

      {/* Live summary of everything selected — this is the actual
          "output" of clicking codes, plus the export action. */}
      {totalSelected > 0 && (
        <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: TEAL }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold" style={{ color: TEAL_DARK }}>
              Selected Codes Summary ({totalSelected})
            </h3>
            <button
              type="button"
              onClick={onExport}
              disabled={exporting}
              className="rounded-md px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: TEAL }}
            >
              {exporting ? "Generating…" : "⬇ Export as DOCX"}
            </button>
          </div>
          {exportErr && <p className="text-xs text-red-600">{exportErr}</p>}
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {selectedList.map((item, i) => (
              <div key={i} className="rounded-md p-2 text-xs" style={{ backgroundColor: TEAL_LIGHT }}>
                <span className="font-semibold" style={{ color: TEAL_DARK }}>{item.code}</span>
                <span className="text-slate-500"> — {item.sectionTitle} — </span>
                <span className="text-slate-700">{item.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Gating / informational modals ---- */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 space-y-4 shadow-xl">
            {modal.kind === "acp" && (
              <>
                <h3 className="text-sm font-bold" style={{ color: TEAL_DARK }}>Advance Care Planning — Confirm Documentation</h3>
                <p className="text-xs text-slate-600">
                  Before this measure can be closed, confirm the following for 99497-33:
                </p>
                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" checked={mWishSigned} onChange={(e) => setMWishSigned(e.target.checked)} className="mt-0.5" />
                  <span>The wish form is signed and dated, with the patient&rsquo;s name on it.</span>
                </label>
                <div>
                  <p className="text-xs font-medium mb-1">Was the patient able to name a decision maker on their behalf?</p>
                  <div className="flex gap-3 text-xs">
                    <label className="flex items-center gap-1"><input type="radio" name="acp-dm" checked={mDecisionMaker === "yes"} onChange={() => setMDecisionMaker("yes")} /> Yes</label>
                    <label className="flex items-center gap-1"><input type="radio" name="acp-dm" checked={mDecisionMaker === "no"} onChange={() => setMDecisionMaker("no")} /> No</label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={closeModal} className="rounded-md px-3 py-1.5 text-xs border border-slate-300">Cancel</button>
                  <button
                    type="button"
                    onClick={confirmAcp}
                    disabled={!mWishSigned || !mDecisionMaker}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: TEAL }}
                  >
                    Confirm &amp; Select
                  </button>
                </div>
              </>
            )}

            {modal.kind === "fallLow" && (
              <>
                <h3 className="text-sm font-bold" style={{ color: TEAL_DARK }}>Fall Risk — Confirm Documentation (1101F)</h3>
                <p className="text-xs text-slate-600">1101F applies to both outcomes below. Which does the documentation show?</p>
                <div className="space-y-1.5 text-xs">
                  <label className="flex items-center gap-2"><input type="radio" name="fall-low" checked={mFallChoice === "no-falls"} onChange={() => setMFallChoice("no-falls")} /> No falls in the past year</label>
                  <label className="flex items-center gap-2"><input type="radio" name="fall-low" checked={mFallChoice === "one-fall"} onChange={() => setMFallChoice("one-fall")} /> One fall in the past year, without injury</label>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={closeModal} className="rounded-md px-3 py-1.5 text-xs border border-slate-300">Cancel</button>
                  <button
                    type="button"
                    onClick={confirmFallLow}
                    disabled={!mFallChoice}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: TEAL }}
                  >
                    Confirm &amp; Select
                  </button>
                </div>
              </>
            )}

            {modal.kind === "fallHigh" && (
              <>
                <h3 className="text-sm font-bold" style={{ color: AMBER }}>Fall Risk — Documentation Reminder (1100F)</h3>
                <p className="text-xs text-slate-600">
                  For 2 or more falls in the past year, documentation must state the medical provider&rsquo;s assessment of the patient&rsquo;s risk of death within the year before this code can be selected.
                </p>
                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" checked={mFallHighAck} onChange={(e) => setMFallHighAck(e.target.checked)} className="mt-0.5" />
                  <span>Confirmed — the provider&rsquo;s risk-of-death assessment is documented.</span>
                </label>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={closeModal} className="rounded-md px-3 py-1.5 text-xs border border-slate-300">Cancel</button>
                  <button
                    type="button"
                    onClick={confirmFallHigh}
                    disabled={!mFallHighAck}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: TEAL }}
                  >
                    Confirm &amp; Select
                  </button>
                </div>
              </>
            )}

            {modal.kind === "foot" && (
              <>
                <h3 className="text-sm font-bold" style={{ color: TEAL_DARK }}>Diabetic Foot Exam — Confirm Documentation ({modal.code})</h3>
                <p className="text-xs text-slate-600">Which exam components does the documentation show?</p>
                <div className="space-y-1.5 text-xs">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={mFootVisual} onChange={(e) => setMFootVisual(e.target.checked)} /> Visual inspection</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={mFootMonofilament} onChange={(e) => setMFootMonofilament(e.target.checked)} /> 10-g monofilament sensory exam</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={mFootOther} onChange={(e) => setMFootOther(e.target.checked)} /> 128-Hz tuning fork, pinprick, ankle reflexes, or vibration perception</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={mFootPulse} onChange={(e) => setMFootPulse(e.target.checked)} /> Pulse exam</label>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={closeModal} className="rounded-md px-3 py-1.5 text-xs border border-slate-300">Cancel</button>
                  <button
                    type="button"
                    onClick={confirmFoot}
                    disabled={!mFootVisual && !mFootMonofilament && !mFootOther && !mFootPulse}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: TEAL }}
                  >
                    Confirm &amp; Select
                  </button>
                </div>
              </>
            )}

            {modal.kind === "depressionInfo" && (
              <>
                <h3 className="text-sm font-bold" style={{ color: TEAL_DARK }}>Depression Screening — Documentation Reminder</h3>
                <p className="text-xs text-slate-600">
                  For complete documentation, Medicare patients need 3 codes: (1) G0444, (2) 3725F, and (3) the outcome code —
                  3351F if negative, or if positive, the PHQ-9 result yields a diagnosis that the provider must confirm and code separately.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={confirmDepressionInfo}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
                    style={{ backgroundColor: TEAL }}
                  >
                    Got it
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
