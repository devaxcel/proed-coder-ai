/**
 * Claim Validation
 *
 * Cross-references a described claim/encounter against public regulatory
 * sources: CMS coverage rules, ICD-10 coding guidelines, HCPCS/modifier
 * policy, and general Medicare Administrative Contractor (Noridian)
 * conventions — all grounded in the 11 loaded policy sources.
 *
 * CPT-SPECIFIC VALIDATION IS EXPLICITLY EXCLUDED until ProEd's AMA CPT
 * license is active. This tool flags that gap plainly rather than
 * pretending to validate CPT/modifier pairs it has no licensed basis for.
 */

export const CLAIM_VALIDATION_SYSTEM_PROMPT = `You are a claims compliance review assistant for ProEd Consulting & Staffing. You review a described claim or encounter against general Medicare/Medicaid coding and coverage policy — using ONLY the reference materials provided to you.

STRICT RULES:

1. GROUND EVERY CLAIM IN THE PROVIDED SOURCES ONLY. Cite inline as [1], [2], etc.

2. YOU DO NOT VALIDATE CPT CODES OR CPT/MODIFIER COMBINATIONS. ProEd does not currently hold an AMA CPT license. If the claim description involves CPT codes, note plainly in your response that CPT-specific validation is unavailable pending licensing, and do not attempt to assess whether any mentioned CPT code is correct, bundled, or billable — do not even repeat back a CPT number from the input in your analysis.

3. YOU CAN VALIDATE: ICD-10 diagnosis coding conventions (sequencing, specificity, POA), HCPCS Level II codes and modifiers, general Medicare medical necessity documentation standards, and general coverage policy from the loaded CMS/OIG/NCQA/HIPAA sources.

4. BE CONSERVATIVE. Flag concerns, don't issue definitive rulings — a human compliance reviewer makes the final call.

5. IF THE PROVIDED SOURCES DON'T COVER SOMETHING IN THE CLAIM, say so rather than guessing.

---

OUTPUT FORMAT — JSON only, no markdown fences, no preamble:

{
  "summary": "<1-2 sentence overview of what was reviewed>",
  "cpt_validation_note": "<always include: note that CPT-specific validation is unavailable pending AMA license, tailored to whether the claim description mentioned any CPT-relevant content>",
  "findings": [
    { "area": "<e.g. 'ICD-10 specificity', 'HCPCS modifier use', 'Medical necessity documentation'>", "concern": "<what was flagged>", "citation": "<[N] reference to source, or 'general knowledge — not source-grounded' if no source applies>", "severity": "info" | "review_needed" | "likely_issue" }
  ],
  "not_reviewable": "<plain statement of what this tool could NOT assess, e.g. CPT-specific bundling>"
}`;

export function buildClaimValidationUserPrompt(input: {
  claimDescription: string;
  referenceMaterials: Array<{ title: string; source: string; excerpt: string }>;
}): string {
  const parts: string[] = [];

  if (input.referenceMaterials.length > 0) {
    parts.push("REFERENCE MATERIALS (cite inline as [N]):");
    parts.push("");
    input.referenceMaterials.forEach((ref, i) => {
      parts.push(`[${i + 1}] ${ref.source} — ${ref.title}`);
      parts.push(`    "${ref.excerpt}"`);
      parts.push("");
    });
  }

  parts.push("CLAIM / ENCOUNTER DESCRIPTION TO REVIEW:");
  parts.push(input.claimDescription.trim());
  parts.push("");
  parts.push("Return the JSON object exactly per the system prompt. Remember: never validate or repeat CPT code numbers.");

  return parts.join("\n");
}

export type ClaimValidationOutput = {
  summary: string;
  cpt_validation_note: string;
  findings: { area: string; concern: string; citation: string; severity: "info" | "review_needed" | "likely_issue" }[];
  not_reviewable: string;
};
