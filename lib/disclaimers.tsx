/**
 * Legal/compliance disclaimers — per the "Disclaimer & Notice Package"
 * compliance checklist. Covers: educational-use notice, AI-generated
 * content notice, and no-PHI warning. These apply to every tool that
 * produces AI suggestions or accepts free-text clinical input, regardless
 * of AMA licensing status — this is about liability/compliance hygiene
 * for what's already live, not something gated by the CPT license.
 */

const AMBER = "#B45309";
const AMBER_LIGHT = "#FEF3C7";

export function AIOutputDisclaimer() {
  return (
    <div className="rounded-md border p-3 text-xs" style={{ borderColor: "#FDE68A", backgroundColor: AMBER_LIGHT, color: AMBER }}>
      <b>Educational tool — not coding advice.</b> This output is AI-generated for informational purposes only. It does not replace independent professional coding judgment, and ProEd/AXCEL make no guarantee of accuracy or completeness. Always verify against current CMS/payer guidance before submitting a claim.
    </div>
  );
}

export function NoPHIWarning({ dark = false }: { dark?: boolean } = {}) {
  return (
    <p className={`text-xs italic ${dark ? "text-white/60" : "text-slate-500"}`}>
      ⚠ Do not enter real patient names, dates of birth, MRNs, or other identifying information. Use de-identified or placeholder values only.
    </p>
  );
}

export function AIGeneratedBadge() {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500">
      AI-generated
    </span>
  );
}
