/**
 * ICD-10-CM "With Convention" Coding Guideline Checker
 *
 * Based on the ICD-10-CM Official Guidelines for Coding and Reporting,
 * Section I.A.15 (the "with" convention): when two conditions commonly
 * linked in the Alphabetic Index are both documented for the same
 * patient, coding guidelines presume they are causally related UNLESS
 * the provider's documentation explicitly states otherwise.
 *
 * This is public-domain CMS/NCHS guideline content — not AMA/CPT
 * material, same status as the rest of ICD-10-CM used throughout this
 * app. The rules below are described in plain language here, not
 * quoted verbatim from the guidelines manual.
 *
 * DELIBERATELY CONSERVATIVE: only the 3 most textbook-certain, widely
 * taught combination-code rules are included. This flags a pattern and
 * explains the guideline — it never auto-selects a specific combination
 * code, since the exact code often needs additional detail (e.g. CKD
 * stage) that only the documentation itself can supply.
 */

export type WithConventionRule = {
  id: string;
  label: string;
  triggerA: { pattern: RegExp; describe: string };
  triggerB: { pattern: RegExp; describe: string };
  guidance: string;
  suggestedCodeRange: string;
  citation: string;
};

export const WITH_CONVENTION_RULES: WithConventionRule[] = [
  {
    id: "diabetes-ckd",
    label: "Diabetes + Chronic Kidney Disease",
    triggerA: { pattern: /^E1[013]\.(?!2)/i, describe: "a diabetes code without an existing kidney-complication suffix (E10/E11/E13, not already .2x)" },
    triggerB: { pattern: /^N18/i, describe: "a chronic kidney disease code (N18 series)" },
    guidance:
      "Both diabetes and chronic kidney disease are documented. Per the ICD-10-CM \"with\" convention, these are presumed to be causally linked unless the provider's documentation specifically states the CKD is unrelated to the diabetes. Consider a diabetic-CKD combination code instead of, or in addition to, the separate codes — the exact code depends on the CKD stage documented.",
    suggestedCodeRange: "E10.22 / E11.22 series (diabetes with diabetic chronic kidney disease)",
    citation: "ICD-10-CM Official Guidelines, Section I.A.15",
  },
  {
    id: "htn-ckd",
    label: "Hypertension + Chronic Kidney Disease",
    triggerA: { pattern: /^I10/i, describe: "essential hypertension (I10)" },
    triggerB: { pattern: /^N18/i, describe: "a chronic kidney disease code (N18 series)" },
    guidance:
      "Both hypertension and chronic kidney disease are documented. Unlike some \"with\" convention pairings, this specific combination is not merely presumed — ICD-10-CM guidelines require assuming a causal relationship between hypertension and CKD and coding it as a combination, regardless of whether the provider explicitly links them. A standalone I10 alongside a standalone N18 code is very likely incomplete coding here.",
    suggestedCodeRange: "I12.0 / I12.9 series (hypertensive chronic kidney disease)",
    citation: "ICD-10-CM Official Guidelines, Section I.C.9.a.2",
  },
  {
    id: "htn-heart-failure",
    label: "Hypertension + Heart Failure",
    triggerA: { pattern: /^I10/i, describe: "essential hypertension (I10)" },
    triggerB: { pattern: /^I50/i, describe: "a heart failure code (I50 series)" },
    guidance:
      "Both hypertension and heart failure are documented. As with hypertensive CKD, ICD-10-CM guidelines require assuming these are causally related and coding this as a combination, rather than reporting hypertension and heart failure as two separate, unrelated codes.",
    suggestedCodeRange: "I11.0 series (hypertensive heart disease with heart failure)",
    citation: "ICD-10-CM Official Guidelines, Section I.C.9.a.1",
  },
];

/**
 * Checks a list of diagnosis codes against every rule. A rule fires
 * only when at least one code matches triggerA AND at least one
 * (different) code matches triggerB — both conditions must genuinely
 * be present in the same code list.
 */
export function checkWithConventionRules(diagnosisCodes: string[]): WithConventionRule[] {
  const codes = diagnosisCodes.map((c) => c.trim()).filter(Boolean);
  const matched: WithConventionRule[] = [];
  for (const rule of WITH_CONVENTION_RULES) {
    const hasA = codes.some((c) => rule.triggerA.pattern.test(c));
    const hasB = codes.some((c) => rule.triggerB.pattern.test(c));
    if (hasA && hasB) matched.push(rule);
  }
  return matched;
}
