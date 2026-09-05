/**
 * Policy Document Generator
 *
 * Produces a full 20-section organizational policy document — the same
 * client-deliverable format ProEd already produces for their consulting
 * clients (see: HIM-DOC-001 Medical Documentation Policy sample). Grounded
 * entirely in the retrieved policy sources; never invents regulatory detail.
 *
 * Citation style: inline bracket numbers [1] [2] matching the same pattern
 * used in Policies Q&A, rather than native Word footnotes — keeps the app
 * consistent and avoids more complex docx footnote objects.
 */

export const POLICY_DOC_SYSTEM_PROMPT = `You are a healthcare compliance policy writer for ProEd Consulting & Staffing, producing a formal 20-section organizational policy document — the kind ProEd delivers to its IPA and health plan clients as a consulting product.

STRICT RULES:

1. GROUND EVERY CLAIM IN THE PROVIDED SOURCES ONLY. You will receive numbered reference materials [1], [2], etc. Cite them inline in section body text like this: "documentation must support medical necessity [1]." Do not introduce regulatory specifics not present in the provided sources.

2. IF SOURCES DON'T COVER A SECTION ADEQUATELY, write a shorter, more general section rather than inventing detail, and note that organizational-specific detail should be added by ProEd's compliance team.

3. PROFESSIONAL, FORMAL POLICY TONE throughout — this is a document a health plan's compliance officer will read and adopt, not a conversational explainer.

4. EACH SECTION SHOULD BE SUBSTANTIVE — 3-6 sentences minimum, more where the topic warrants it. Avoid one-line placeholder sections.

5. USE THE STANDARD 20-SECTION STRUCTURE below. Adapt section content to the requested policy topic, but keep the section titles and order consistent — this is the same skeleton ProEd uses for all their policy deliverables:

1. Purpose and Scope
2. Regulatory Basis and Authority
3. Definitions
4. Policy Statement
5. Applicability
6. Roles and Responsibilities
7. Documentation Requirements
8. Coding and Billing Standards
9. Quality and Risk Adjustment Considerations
10. Compliance Monitoring and Auditing
11. Training Requirements
12. Non-Compliance and Corrective Action
13. Record Retention
14. Confidentiality and Privacy
15. Exceptions and Exclusions
16. Related Policies and Cross-References
17. Review and Revision Cycle
18. Approval and Authorization
19. References and Sources
20. Version History

For sections 19 and 20 specifically: Section 19 should be a brief intro sentence only (the actual reference list is rendered separately from your structured output, not written by you). Section 20 should be a brief intro sentence only (the version history table is rendered separately, not written by you).

---

OUTPUT FORMAT — JSON only, no markdown fences, no preamble:

{
  "policy_title": "<formal policy title based on the requested topic>",
  "policy_number_suggestion": "<short suggested ID like 'PCS-DOC-HCC-001'>",
  "regulatory_basis_summary": "<one line naming the primary regulatory bodies/sources this policy draws from>",
  "applies_to": "<one line: who this policy applies to, e.g. 'All coding, CDI, and auditing staff'>",
  "confidentiality": "Internal Use" | "Confidential" | "Restricted",
  "disclaimer": "<1-2 sentence educational/legal disclaimer, standard compliance-document language>",
  "sections": [
    { "number": 1, "heading": "Purpose and Scope", "body": "<substantive paragraph(s), cite sources inline as [1] [2] etc>" }
  ],
  "citations_used": [1, 2, 3]
}

Provide all 20 sections in the array, each following the standard structure and numbering above.`;

export function buildPolicyDocUserPrompt(input: {
  topic: string;
  payerType?: "medicare" | "commercial" | null;
  referenceMaterials: Array<{ title: string; source: string; excerpt: string; sourceUrl: string }>;
  priorDocument?: PolicyDocOutput | null;
  revisionInstruction?: string | null;
}): string {
  const parts: string[] = [];

  parts.push(`POLICY TOPIC REQUESTED: ${input.topic.trim()}`);

  if (input.payerType) {
    const label = input.payerType === "medicare" ? "Medicare / Medicare Advantage" : "Commercial insurance";
    parts.push(
      `PAYER CONTEXT: This policy applies specifically to ${label} claims. Tailor terminology and considerations accordingly where relevant (e.g., Medicare program requirements vs. commercial payer contract terms). Do not include specific procedure code numbers tied to this payer type — general guidance only.`
    );
  }
  parts.push("");

  if (input.referenceMaterials.length > 0) {
    parts.push("REFERENCE MATERIALS (cite inline as [N], ground every regulatory claim in these):");
    parts.push("");
    input.referenceMaterials.forEach((ref, i) => {
      parts.push(`[${i + 1}] ${ref.source} — ${ref.title}`);
      parts.push(`    "${ref.excerpt}"`);
      parts.push("");
    });
  } else {
    parts.push("(No reference materials were retrieved for this topic — write more general sections and note that ProEd's compliance team should add organization-specific detail.)");
    parts.push("");
  }

  if (input.priorDocument && input.revisionInstruction) {
    parts.push("--- THIS IS A REVISION REQUEST, NOT A NEW DOCUMENT ---");
    parts.push("");
    parts.push("PREVIOUS VERSION (JSON):");
    parts.push(JSON.stringify(input.priorDocument, null, 2));
    parts.push("");
    parts.push(`REQUESTED CHANGE: "${input.revisionInstruction.trim()}"`);
    parts.push("");
    parts.push(
      "Produce a REVISED full 20-section document that applies this specific change. Keep everything else from the previous version consistent unless the requested change reasonably implies broader edits (e.g., \"make it shorter\" may mean trimming multiple sections). Still ground every claim in the reference materials above. Return the complete JSON object per the system prompt — not just the changed part."
    );
  } else {
    parts.push("Produce the full 20-section policy document JSON per the system prompt.");
  }

  return parts.join("\n");
}

export type PolicyDocSection = { number: number; heading: string; body: string };

export type PolicyDocOutput = {
  policy_title: string;
  policy_number_suggestion: string;
  regulatory_basis_summary: string;
  applies_to: string;
  confidentiality: "Internal Use" | "Confidential" | "Restricted";
  disclaimer: string;
  sections: PolicyDocSection[];
  citations_used: number[];
};
