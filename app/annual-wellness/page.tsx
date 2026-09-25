"use client";

import { useMemo, useState } from "react";
import AwvMeasuresPanel from "./AwvMeasuresPanel";
import { THEME } from "@/lib/theme";

const TEAL = THEME.primary;
const TEAL_LIGHT = THEME.primaryLight;
const TEAL_DARK = THEME.primary;

// ---- Medication list (from ProEd's Meds List, organized by class) ----
const MEDS: Record<string, string[]> = {
  "Beta Blockers": ["Carvedilol", "Labetalol", "Nadolol", "Pindolol", "Propranolol", "Timolol", "Sotalol", "Acebutolol", "Atenolol", "Betaxolol", "Bisoprolol", "Metoprolol", "Nebivolol", "Atenolol-chlorthalidone", "Bendroflumethiazide-nadolol", "Bisoprolol-hydrochlorothiazide", "Hydrochlorothiazide-metoprolol", "Hydrochlorothiazide-propranolol"],
  "Diuretics": ["Indapamide", "Bendroflumethiazide", "Chlortalidone", "Cyclopenthiazide", "Furosemide", "Spironolactone", "Acetazolamide"],
  "COPD Meds": ["Cortisone", "Dexamethasone", "Hydrocortisone", "Methylprednisolone", "Prednisolone", "Prednisone", "Aclidinium-bromide", "Ipratropium", "Tiotropium", "Umeclidinium", "Albuterol", "Arformoterol", "Formoterol", "Indacaterol", "Levalbuterol", "Metaproterenol", "Olodaterol", "Salmeterol", "Albuterol-ipratropium", "Budesonide-formoterol", "Fluticasone-salmeterol", "Fluticasone-vilanterol", "Fluticasone furoate-umeclidinium-vilanterol", "Formoterol-glycopyrrolate", "Formoterol-mometasone", "Glycopyrrolate-indacaterol", "Olodaterol-tiotropium", "Umeclidinium-vilanterol"],
  "Antidepressants": ["Bupropion", "Vilazodone", "Vortioxetine", "Isocarboxazid", "Phenelzine", "Selegiline", "Tranylcypromine", "Nefazodone", "Trazodone", "Amitriptyline-chlordiazepoxide", "Amitriptyline-perphenazine", "Fluoxetine-olanzapine", "Desvenlafaxine", "Duloxetine", "Levomilnacipran", "Venlafaxine", "Fluoxetine", "Fluvoxamine", "Paroxetine", "Sertraline", "Maprotiline", "Mirtazapine", "Amitriptyline", "Amoxapine", "Clomipramine", "Desipramine", "Doxepin (>6 mg)", "Imipramine", "Nortriptyline", "Protriptyline", "Trimipramine"],
  "Pharyngitis Meds": ["Amoxicillin", "Ampicillin", "Amoxicillin-clavulanate", "Cefadroxil", "Cefazolin", "Cephalexin", "Trimethoprim", "Clindamycin", "Azithromycin", "Clarithromycin", "Erythromycin", "Penicillin G potassium", "Penicillin G sodium", "Penicillin V potassium", "Penicillin G benzathine", "Ciprofloxacin", "Levofloxacin", "Moxifloxacin", "Ofloxacin", "Cefaclor", "Cefprozil", "Cefuroxime", "Sulfamethoxazole-trimethoprim", "Doxycycline", "Minocycline", "Tetracycline", "Cefdinir", "Cefixime", "Cefpodoxime", "Ceftriaxone", "Trimipramine"],
  "URI Meds": ["Amikacin", "Gentamicin", "Streptomycin", "Tobramycin", "Amoxicillin", "Ampicillin", "Amoxicillin-clavulanate", "Ampicillin-sulbactam", "Piperacillin-tazobactam", "Cefadroxil", "Cefazolin", "Cephalexin", "Cefepime", "Clindamycin", "Lincomycin", "Azithromycin", "Clarithromycin", "Erythromycin", "Aztreonam", "Chloramphenicol", "Dalfopristin-quinupristin", "Daptomycin", "Linezolid", "Metronidazole", "Vancomycin", "Penicillin G benzathine-procaine", "Penicillin G potassium", "Penicillin G procaine", "Penicillin G sodium", "Penicillin V potassium", "Dicloxacillin", "Nafcillin", "Oxacillin"],
  "Opioids": ["Benzhydrocodone", "Butorphanol", "Codeine", "Dihydrocodeine", "Fentanyl oral spray", "Fentanyl buccal/sublingual/transmucosal lozenge", "Fentanyl transdermal patch", "Fentanyl nasal spray", "Hydrocodone", "Hydromorphone", "Levorphanol", "Meperidine", "Methadone"],
  "Statin Therapy": ["Atorvastatin", "Amlodipine-atorvastatin", "Rosuvastatin", "Simvastatin", "Ezetimibe-simvastatin", "Pravastatin", "Lovastatin", "Fluvastatin", "Pitavastatin"],
  "Pain Medication": ["Acetaminophen (Tylenol)", "Aspirin", "Ibuprofen (Advil, Motrin)", "Naproxen (Aleve)"],
  "Asthma": ["Omalizumab", "Dupilumab", "Benralizumab", "Mepolizumab", "Reslizumab", "Beclomethasone", "Budesonide", "Ciclesonide", "Flunisolide", "Fluticasone", "Mometasone", "Budesonide-formoterol", "Fluticasone-salmeterol", "Fluticasone-vilanterol", "Formoterol-mometasone", "Montelukast", "Zafirlukast", "Zileuton", "Theophylline", "Fluticasone furoate-umeclidinium-vilanterol", "Salmeterol", "Tiotropium"],
  "ACE Inhibitors / ARBs": ["Benazepril (Lotensin)", "Lisinopril (Zestril, Prinivil)", "Quinapril (Accupril)", "Ramipril (Altace)", "Irbesartan (Avapro)", "Losartan (Cozaar)", "Olmesartan (Benicar)", "Valsartan (Diovan)"],
  "Anticonvulsants / Seizure": ["Brivaracetam (Briviact)", "Cannabidiol (Epidiolex)", "Carbamazepine (Epitol, Tegretol)", "Cenobarnate (Xcopri)", "Clobazam (Onfi)", "Clonazepam (Ceberclon, Klonopin)", "Eslicarbazepine (Aptiom)", "Ethosuximide (Zarontin)", "Felbamate (Felbatol)", "Fosphenytoin (Cerebyx)", "Gabapentin (Horizant, Gralise, Neurontin)", "Lacosamide (Vimpat)", "Levetiracetam (Keppra, Roweepra)", "Oxcarbazepine (Trileptal)", "Perampanel (Fycompa)", "Phenobarbital (Solfoton, Luminal)", "Pregabalin (Lyrica)", "Primidone (Mysoline)", "Rufinamide (Banzel)", "Stiripentol (Diacomit)", "Tiagabine (Gabitril)", "Topiramate (Topamax, Topiragen)", "Valproate sodium (Depacon)", "Divalproex sodium (Depakote)", "Valproic acid (Depakene, Stavzor)", "Vigabatrin (Sabril)", "Zonisamide (Zonegran)"],
  "Digoxin": ["Digoxin"],
  "Osteoporosis": ["Denosumab", "Ibandronate", "Teriparatide", "Risedronate", "Abaloparatide", "Alendronate (Fosamax)", "Zoledronate", "Romosozumab", "Bisphosphonate", "Calcitonin", "Parathyroid hormone", "Bazedoxifene", "Raloxifene", "Zoledronic acid", "Hormone replacement therapy", "Risedronate (Actonel, Atelvia)", "Miacalcin (calcitonin salmon)"],
  "DMARD Therapy": ["Methotrexate", "Hydroxychloroquine (Plaquenil)", "Sulfasalazine", "Leflunomide (Arava)", "Adalimumab (Humira)", "Etanercept (Enbrel)", "Infliximab (Remicade)", "Golimumab (Simponi)", "Certolizumab pegol (Cimzia)", "Abatacept (Orencia)", "Tocilizumab (Actemra)", "Rituximab (Rituxan)", "Tofacitinib (Xeljanz)", "Baricitinib (Olumiant)", "Upadacitinib (Rinvoq)"],
  "Antipsychotics": ["Risperidone (Risperdal)", "Olanzapine (Zyprexa)", "Quetiapine (Seroquel)", "Aripiprazole (Abilify)", "Ziprasidone (Geodon)", "Haloperidol (Haldol)", "Clozapine (Clozaril)", "Paliperidone (Invega)", "Lurasidone (Latuda)", "Chlorpromazine (Thorazine)", "Fluphenazine", "Perphenazine", "Brexpiprazole (Rexulti)", "Cariprazine (Vraylar)", "Asenapine (Saphris)"],
};

// HEDIS measure code(s) tied to a drug class — only populated for classes
// where a real HEDIS "medication prescribed/currently taken" code exists.
// Confirmed against the full 144-code HEDIS Measures dataset; classes not
// listed here (COPD Meds, Opioids, Anticonvulsants, Digoxin) genuinely
// have no matching code and are intentionally left without one.
const MEDS_HEDIS_CODE: Record<string, { codes: string; label: string }> = {
  "Beta Blockers": { codes: "4008F", label: "Beta Blocker Prescribed or Currently Being Taken" },
  "Statin Therapy": { codes: "4013F", label: "Statin therapy prescribed or currently being taken" },
  "Diuretics": { codes: "4190F, 4221F", label: "Diuretic Monitor Ordered / Therapy > 6 months" },
  "ACE Inhibitors / ARBs": { codes: "4095F, 4010F, 4210F", label: "ACE/ARB Prescribed (1st time / currently taken / > 6 months)" },
  "Antidepressants": { codes: "4063F, 4064F", label: "Antidepressant Pharmacotherapy NOT Prescribed / Prescribed" },
  "Osteoporosis": { codes: "4005F", label: "Osteoporosis Pharmacologic Therapy" },
  "Pain Medication": { codes: "4016F", label: "Anti-inflammatory/Analgesic Agent Prescribed (OA)" },
  "Asthma": { codes: "4015F, 4140F, 4144F", label: "Long-Term Control Medication / Inhaled Corticosteroid" },
  "Pharyngitis Meds": { codes: "4120F, 4124F", label: "Antibiotic Prescribed or Dispensed / Not Prescribed" },
  "URI Meds": { codes: "4120F, 4124F", label: "Antibiotic Prescribed or Dispensed / Not Prescribed" },
  "DMARD Therapy": { codes: "4187F", label: "DMARD Therapy Prescribed or Dispensed (RA)" },
  "Antipsychotics": { codes: "4065F", label: "Antipsychotic Pharmacotherapy Prescribed" },
};

function Field({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options?: string[] }) {
  return (
    <div>
      <label className="mb-0.5 block text-xs font-medium" style={{ color: TEAL }}>{label}</label>
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
          <option value="">—</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" />
      )}
    </div>
  );
}

export default function AnnualWellnessPage() {
  // Meds search state
  const [medsQuery, setMedsQuery] = useState("");
  const [activeClass, setActiveClass] = useState<string>(Object.keys(MEDS)[0]);
  const filteredMeds = useMemo(() => {
    if (!medsQuery.trim()) return { [activeClass]: MEDS[activeClass] };
    const q = medsQuery.toLowerCase();
    const out: Record<string, string[]> = {};
    for (const [cls, list] of Object.entries(MEDS)) {
      const matches = list.filter((m) => m.toLowerCase().includes(q));
      if (matches.length) out[cls] = matches;
    }
    return out;
  }, [medsQuery, activeClass]);

  return (
    <div className="space-y-10">
      {/* Header */}
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3" style={{ backgroundColor: TEAL }}>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white leading-snug">Annual Wellness</h1>
            <p className="mt-1 text-sm text-white/85">Medication reference · Full quality measures panel below</p>
          </div>
          <div className="rounded-md bg-white/95 px-4 py-2 text-center shadow-sm">
            <div className="font-serif italic text-lg leading-none" style={{ color: TEAL_DARK }}>proed</div>
            <div className="text-[9px] uppercase tracking-wide text-slate-500 mt-0.5">Consulting · Staffing · Scanning</div>
          </div>
        </div>
      </section>

      {/* === Medication Reference List === */}
      <section>
        <div className="px-4 py-2 text-white font-semibold text-sm rounded-t-lg" style={{ backgroundColor: TEAL }}>
          Medication Reference List
        </div>
        <div className="border rounded-b-lg p-5 space-y-4" style={{ borderColor: TEAL }}>
          <input
            value={medsQuery}
            onChange={(e) => setMedsQuery(e.target.value)}
            placeholder="Search a medication name…"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />

          {!medsQuery && (
            <div className="flex flex-wrap gap-1">
              {Object.keys(MEDS).map((cls) => (
                <button
                  key={cls}
                  onClick={() => setActiveClass(cls)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium border"
                  style={{
                    borderColor: TEAL,
                    backgroundColor: activeClass === cls ? TEAL : "white",
                    color: activeClass === cls ? "white" : TEAL_DARK,
                  }}
                >
                  {cls}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {Object.entries(filteredMeds).map(([cls, list]) => {
              const hedis = MEDS_HEDIS_CODE[cls];
              return (
                <div key={cls}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-xs font-semibold" style={{ color: TEAL_DARK }}>{cls}</div>
                    {hedis && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: TEAL, color: "white" }}
                        title={hedis.label}
                      >
                        HEDIS: {hedis.codes}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((m) => (
                      <span key={m} className="rounded px-2 py-1 text-xs" style={{ backgroundColor: TEAL_LIGHT, color: "#1F2937" }}>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            {Object.keys(filteredMeds).length === 0 && (
              <p className="text-sm text-slate-500">No medications match &ldquo;{medsQuery}&rdquo;.</p>
            )}
          </div>
        </div>
      </section>

      <AwvMeasuresPanel />

      <p className="text-xs text-slate-500">
        Source: ProEd Consulting AWV/HEDIS Tool 2026, BMI ICD-10 reference, and internal medication list. Verified against NCQA HEDIS MY 2026 &amp; CMS CY 2026 MPFS Final Rule (CMS-1832-F).
      </p>
    </div>
  );
}
