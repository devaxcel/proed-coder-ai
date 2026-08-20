"use client";

import { useMemo, useState } from "react";

const TEAL = "#0F6E77";
const TEAL_LIGHT = "#E6F4F5";
const TEAL_DARK = "#0A555C";

// ---- BMI / Obesity data (full table from ProEd's BMI ICD-10 reference) ----
const BMI_TABLE = [
  { code: "Z68.1", range: [0, 19.9], label: "≤ 19.9", category: "Underweight" },
  { code: "Z68.20", range: [20.0, 20.9], label: "20.0–20.9", category: "Normal weight" },
  { code: "Z68.21", range: [21.0, 21.9], label: "21.0–21.9", category: "Normal weight" },
  { code: "Z68.22", range: [22.0, 22.9], label: "22.0–22.9", category: "Normal weight" },
  { code: "Z68.23", range: [23.0, 23.9], label: "23.0–23.9", category: "Normal weight" },
  { code: "Z68.24", range: [24.0, 24.9], label: "24.0–24.9", category: "Normal weight" },
  { code: "Z68.25", range: [25.0, 25.9], label: "25.0–25.9", category: "Overweight" },
  { code: "Z68.26", range: [26.0, 26.9], label: "26.0–26.9", category: "Overweight" },
  { code: "Z68.27", range: [27.0, 27.9], label: "27.0–27.9", category: "Overweight" },
  { code: "Z68.28", range: [28.0, 28.9], label: "28.0–28.9", category: "Overweight" },
  { code: "Z68.29", range: [29.0, 29.9], label: "29.0–29.9", category: "Overweight" },
  { code: "Z68.30", range: [30.0, 30.9], label: "30.0–30.9", category: "Obesity, Class 1" },
  { code: "Z68.31", range: [31.0, 31.9], label: "31.0–31.9", category: "Obesity, Class 1" },
  { code: "Z68.32", range: [32.0, 32.9], label: "32.0–32.9", category: "Obesity, Class 1" },
  { code: "Z68.33", range: [33.0, 33.9], label: "33.0–33.9", category: "Obesity, Class 1" },
  { code: "Z68.34", range: [34.0, 34.9], label: "34.0–34.9", category: "Obesity, Class 1" },
  { code: "Z68.35", range: [35.0, 35.9], label: "35.0–35.9", category: "Obesity, Class 2" },
  { code: "Z68.36", range: [36.0, 36.9], label: "36.0–36.9", category: "Obesity, Class 2" },
  { code: "Z68.37", range: [37.0, 37.9], label: "37.0–37.9", category: "Obesity, Class 2" },
  { code: "Z68.38", range: [38.0, 38.9], label: "38.0–38.9", category: "Obesity, Class 2" },
  { code: "Z68.39", range: [39.0, 39.9], label: "39.0–39.9", category: "Obesity, Class 2" },
  { code: "Z68.41", range: [40.0, 44.9], label: "40.0–44.9", category: "Obesity, Class 3" },
  { code: "Z68.42", range: [45.0, 49.9], label: "45.0–49.9", category: "Obesity, Class 3" },
  { code: "Z68.43", range: [50.0, 59.9], label: "50.0–59.9", category: "Obesity, Class 3" },
  { code: "Z68.44", range: [60.0, 69.9], label: "60.0–69.9", category: "Obesity, Class 3" },
  { code: "Z68.45", range: [70.0, 999], label: "≥ 70", category: "Obesity, Class 3" },
];

const E66_TABLE = [
  { code: "E66.3", range: [25.0, 29.9], label: "Overweight" },
  { code: "E66.811", range: [30.0, 34.9], label: "Obesity, class 1" },
  { code: "E66.812", range: [35.0, 39.9], label: "Obesity, class 2" },
  { code: "E66.813", range: [40.0, 999], label: "Obesity, class 3 (may also support E66.01/E66.2 if documented as morbid/severe with alveolar hypoventilation)" },
];

function lookupBmi(bmi: number) {
  const z = BMI_TABLE.find((r) => bmi >= r.range[0] && bmi <= r.range[1]);
  const e = E66_TABLE.find((r) => bmi >= r.range[0] && bmi <= r.range[1]);
  return { z, e };
}

// ---- AWV visit-type logic ----
type AwvAnswer = "welcome" | "first" | "subsequent" | "fqhc" | null;

const AWV_RESULTS: Record<
  Exclude<AwvAnswer, null>,
  { code: string; desc: string; note: string }
> = {
  welcome: {
    code: "G0402",
    desc: "Welcome to Medicare / Initial Preventive Physical Exam (IPPE)",
    note: "One-time only, within the first 12 months of Medicare Part B enrollment. Performed in office; POS 11.",
  },
  first: {
    code: "G0438",
    desc: "Annual Wellness Visit, Initial",
    note: "First AWV — billed once per patient, after any IPPE (G0402) or independently if IPPE wasn't performed. Dx Z00.00; POS 11.",
  },
  subsequent: {
    code: "G0439",
    desc: "Annual Wellness Visit, Subsequent",
    note: "Every year after the initial AWV (G0438). Dx Z00.00; POS 11. This is also the only AWV code depression screening G0444 can be billed separately with.",
  },
  fqhc: {
    code: "G0468",
    desc: "FQHC/RHC visit, IPPE or AWV",
    note: "⚠️ Once-in-a-lifetime per patient at this facility type — verify no prior G0468 exists before billing. FQHC/RHC only; POS 11.",
  },
};

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
  // AWV helper state
  const [awvAnswer, setAwvAnswer] = useState<AwvAnswer>(null);

  // BMI state
  const [bmiInput, setBmiInput] = useState("");
  const bmiResult = useMemo(() => {
    const n = parseFloat(bmiInput);
    if (isNaN(n) || n <= 0) return null;
    return lookupBmi(n);
  }, [bmiInput]);

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
            <p className="mt-1 text-sm text-white/85">AWV visit type · BMI/Obesity coding · Medication reference</p>
          </div>
          <div className="rounded-md bg-white/95 px-4 py-2 text-center shadow-sm">
            <div className="font-serif italic text-lg leading-none" style={{ color: TEAL_DARK }}>proed</div>
            <div className="text-[9px] uppercase tracking-wide text-slate-500 mt-0.5">Consulting · Staffing · Scanning</div>
          </div>
        </div>
      </section>

      {/* === Section 1: AWV Visit Type Helper === */}
      <section>
        <div className="px-4 py-2 text-white font-semibold text-sm rounded-t-lg" style={{ backgroundColor: TEAL }}>
          1 · Which AWV Code Applies?
        </div>
        <div className="border rounded-b-lg p-5 space-y-4" style={{ borderColor: TEAL }}>
          <p className="text-sm text-slate-600">Select the situation that matches this visit:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: "welcome", label: "Patient's first-ever preventive visit, within 12 months of Medicare Part B enrollment" },
              { key: "first", label: "Patient's first Annual Wellness Visit (no prior AWV on file)" },
              { key: "subsequent", label: "Patient has had an AWV before — this is a follow-up year" },
              { key: "fqhc", label: "Visit is at an FQHC or RHC" },
            ].map((opt) => (
              <label
                key={opt.key}
                className="flex items-start gap-2 rounded-md border p-3 cursor-pointer text-sm"
                style={{ borderColor: awvAnswer === opt.key ? TEAL : "#E2E8F0", backgroundColor: awvAnswer === opt.key ? TEAL_LIGHT : "white" }}
              >
                <input type="radio" name="awv" checked={awvAnswer === opt.key} onChange={() => setAwvAnswer(opt.key as AwvAnswer)} className="mt-1" style={{ accentColor: TEAL }} />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          {awvAnswer && (
            <div className="rounded-md border p-4" style={{ borderColor: TEAL, backgroundColor: TEAL_LIGHT }}>
              <div className="text-lg font-bold" style={{ color: TEAL_DARK }}>{AWV_RESULTS[awvAnswer].code}</div>
              <div className="text-sm font-medium text-slate-800">{AWV_RESULTS[awvAnswer].desc}</div>
              <div className="text-xs text-slate-600 mt-1">{AWV_RESULTS[awvAnswer].note}</div>
            </div>
          )}

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <b>G0136</b> — Physical Activity and Nutrition Risk Assessment. Available every 6 months alongside an AWV or E/M visit; not standalone. If billed same-day with a covered AWV, append modifier 33 to waive Part B deductible/coinsurance.
          </div>
        </div>
      </section>

      {/* === Section 2: BMI / Obesity Lookup === */}
      <section>
        <div className="px-4 py-2 text-white font-semibold text-sm rounded-t-lg" style={{ backgroundColor: TEAL }}>
          2 · BMI &amp; Obesity Code Lookup
        </div>
        <div className="border rounded-b-lg p-5 space-y-4" style={{ borderColor: TEAL }}>
          <div className="flex items-end gap-3">
            <div>
              <label className="mb-0.5 block text-xs font-medium" style={{ color: TEAL }}>Patient BMI value</label>
              <input
                type="number"
                step="0.1"
                value={bmiInput}
                onChange={(e) => setBmiInput(e.target.value)}
                placeholder="e.g., 32.4"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm w-40"
              />
            </div>
          </div>

          {bmiResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-md border p-3" style={{ borderColor: TEAL, backgroundColor: TEAL_LIGHT }}>
                <div className="text-xs font-semibold" style={{ color: TEAL_DARK }}>BMI diagnosis code (Z68.x)</div>
                {bmiResult.z ? (
                  <>
                    <div className="text-lg font-bold" style={{ color: TEAL_DARK }}>{bmiResult.z.code}</div>
                    <div className="text-sm text-slate-700">{bmiResult.z.category} ({bmiResult.z.label})</div>
                  </>
                ) : <div className="text-sm text-slate-500">Out of adult table range</div>}
              </div>
              <div className="rounded-md border border-slate-200 p-3 bg-white">
                <div className="text-xs font-semibold text-slate-600">Companion obesity code (E66.x), if clinically documented</div>
                {bmiResult.e ? (
                  <>
                    <div className="text-lg font-bold text-slate-800">{bmiResult.e.code}</div>
                    <div className="text-sm text-slate-700">{bmiResult.e.label}</div>
                  </>
                ) : <div className="text-sm text-slate-500">Not applicable at this BMI</div>}
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500">
            Z68.x codes are for adults 20+. Pair a Z-code (BMI value) with an E66.x code when obesity is clinically documented by the provider — do not assign E66.x from BMI value alone. For HEDIS Adult BMI Assessment (ABA), document the BMI value <em>and</em> the Z68.x code.
          </p>

          <details className="text-sm">
            <summary className="cursor-pointer font-medium" style={{ color: TEAL }}>Browse full BMI code table</summary>
            <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-slate-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0" style={{ backgroundColor: TEAL_DARK }}>
                  <tr>
                    <th className="px-2 py-1 text-left text-white">Code</th>
                    <th className="px-2 py-1 text-left text-white">BMI Range</th>
                    <th className="px-2 py-1 text-left text-white">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {BMI_TABLE.map((row, i) => (
                    <tr key={row.code} style={{ backgroundColor: i % 2 === 0 ? TEAL_LIGHT : "white" }}>
                      <td className="px-2 py-1 font-medium">{row.code}</td>
                      <td className="px-2 py-1">{row.label}</td>
                      <td className="px-2 py-1">{row.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </section>

      {/* === Section 3: Medication List === */}
      <section>
        <div className="px-4 py-2 text-white font-semibold text-sm rounded-t-lg" style={{ backgroundColor: TEAL }}>
          3 · Medication Reference List
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
            {Object.entries(filteredMeds).map(([cls, list]) => (
              <div key={cls}>
                <div className="text-xs font-semibold mb-1" style={{ color: TEAL_DARK }}>{cls}</div>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((m) => (
                    <span key={m} className="rounded px-2 py-1 text-xs" style={{ backgroundColor: TEAL_LIGHT, color: "#1F2937" }}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(filteredMeds).length === 0 && (
              <p className="text-sm text-slate-500">No medications match &ldquo;{medsQuery}&rdquo;.</p>
            )}
          </div>
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Source: ProEd Consulting AWV/HEDIS Tool 2026, BMI ICD-10 reference, and internal medication list. Verified against NCQA HEDIS MY 2026 &amp; CMS CY 2026 MPFS Final Rule (CMS-1832-F).
      </p>
    </div>
  );
}
