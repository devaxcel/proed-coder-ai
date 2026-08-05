import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { chat } from "@/lib/llm";
import { retrievePolicyChunks } from "@/lib/policy-retrieval";
import {
  FORM_A_SYSTEM_PROMPT,
  buildFormAUserPrompt,
  type FormAOutput,
  type QueryFormHeaderInputs,
} from "@/lib/query-form-prompts";

export const runtime = "nodejs";

const HeaderSchema = z
  .object({
    patientName: z.string().optional(),
    mrn: z.string().optional(),
    dob: z.string().optional(),
    dateOfService: z.string().optional(),
    setting: z.string().optional(),
    payerType: z.string().optional(),
    attendingProvider: z.string().optional(),
    providerNpi: z.string().optional(),
    providerSpecialty: z.string().optional(),
    queryAuthorName: z.string().optional(),
    queryAuthorRole: z.string().optional(),
    queryAuthorContact: z.string().optional(),
  })
  .partial();

const Body = z.object({
  scenario: z.string().min(10).max(4000),
  header: HeaderSchema.optional().default({}),
});

type Citation = {
  n: number;
  chunkId: string;
  policyDocId: string;
  source: string;
  docTitle: string;
  sourceUrl: string;
  excerpt: string;
};

function safeParseLlmJson(raw: string): FormAOutput | null {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const firstBrace = s.indexOf("{");
  if (firstBrace > 0) s = s.slice(firstBrace);
  const lastBrace = s.lastIndexOf("}");
  if (lastBrace >= 0 && lastBrace < s.length - 1) s = s.slice(0, lastBrace + 1);
  try {
    const obj = JSON.parse(s);
    return {
      query_id_suggestion: String(obj.query_id_suggestion ?? ""),
      priority: ["concurrent", "pre_bill", "retro", "audit"].includes(obj.priority)
        ? obj.priority
        : "concurrent",
      query_types: Array.isArray(obj.query_types)
        ? obj.query_types.filter((x: unknown) => typeof x === "string")
        : [],
      impact_domains: Array.isArray(obj.impact_domains)
        ? obj.impact_domains.filter((x: unknown) => typeof x === "string")
        : [],
      clinical_indicators: {
        source_document: String(obj.clinical_indicators?.source_document ?? ""),
        indicators: Array.isArray(obj.clinical_indicators?.indicators)
          ? obj.clinical_indicators.indicators
              .filter((x: unknown) => typeof x === "string")
              .slice(0, 12)
          : [],
      },
      clarification_question: String(obj.clarification_question ?? ""),
      clinically_reasonable_options: Array.isArray(obj.clinically_reasonable_options)
        ? obj.clinically_reasonable_options
            .filter((x: unknown) => typeof x === "string")
            .slice(0, 4)
        : [],
      poa_applicable: !!obj.poa_applicable,
      poa_context: String(obj.poa_context ?? ""),
      reason_for_query: String(obj.reason_for_query ?? ""),
      compliance_checklist: {
        cites_specific_indicators: !!obj.compliance_checklist?.cites_specific_indicators,
        offers_multiple_options: !!obj.compliance_checklist?.offers_multiple_options,
        includes_other_and_unable_to_determine:
          !!obj.compliance_checklist?.includes_other_and_unable_to_determine,
        non_leading: !!obj.compliance_checklist?.non_leading,
        defines_reason_for_query: !!obj.compliance_checklist?.defines_reason_for_query,
      },
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { scenario, header } = parsed.data;
  const headerInputs: QueryFormHeaderInputs = header ?? {};

  let policyChunks: Awaited<ReturnType<typeof retrievePolicyChunks>> = [];
  try {
    policyChunks = await retrievePolicyChunks(scenario, 4);
  } catch (e) {
    console.error("Policy retrieval failed:", e);
  }

  const referenceMaterials = policyChunks.map((c) => ({
    title: c.docTitle,
    source: c.sourceName,
    excerpt: c.content.slice(0, 400),
  }));

  const userPrompt = buildFormAUserPrompt({
    scenario,
    header: headerInputs,
    referenceMaterials,
  });

  let raw: string;
  try {
    raw = await chat({
      system: FORM_A_SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 1800,
      temperature: 0.15,
    });
  } catch (e) {
    console.error("LLM call failed:", e);
    return NextResponse.json(
      { error: "LLM generation failed. Check GROQ_API_KEY." },
      { status: 500 }
    );
  }

  const form = safeParseLlmJson(raw);
  const citations: Citation[] = policyChunks.map((c, i) => ({
    n: i + 1,
    chunkId: c.chunkId,
    policyDocId: c.policyDocId,
    source: c.sourceName,
    docTitle: c.docTitle,
    sourceUrl: c.sourceUrl,
    excerpt: c.content.slice(0, 300),
  }));

  if (!form) {
    return NextResponse.json({
      error: "Could not parse structured Form A response. Try rephrasing the scenario.",
      raw: raw.slice(0, 400),
      citations,
      latencyMs: Date.now() - t0,
    });
  }

  db.auditLog
    .create({
      data: {
        action: "query_form_generate",
        payload: {
          formType: "A",
          scenarioPreview: scenario.slice(0, 200),
          queryTypes: form.query_types,
          impactDomains: form.impact_domains,
          citationsCount: citations.length,
        },
      },
    })
    .catch(() => {});

  return NextResponse.json({
    formType: "A",
    form,
    header: headerInputs,
    citations,
    latencyMs: Date.now() - t0,
    structured: true,
  });
}
