import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { chat } from "@/lib/llm";
import { retrievePolicyChunks } from "@/lib/policy-retrieval";
import { buildFormSystemPrompt, buildFormUserPrompt, type FormBHOutput, type FormLetter } from "@/lib/query-form-bh-prompts";
import type { QueryFormHeaderInputs } from "@/lib/query-form-prompts";

export const runtime = "nodejs";

const VALID_LETTERS: FormLetter[] = ["B", "C", "D", "E", "F", "G", "H"];

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
  formLetter: z.enum(["B", "C", "D", "E", "F", "G", "H"]),
  scenario: z.string().min(10).max(4000),
  header: HeaderSchema.optional().default({}),
});

function safeParseLlmJson(raw: string, letter: FormLetter): FormBHOutput | null {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const firstBrace = s.indexOf("{");
  if (firstBrace > 0) s = s.slice(firstBrace);
  const lastBrace = s.lastIndexOf("}");
  if (lastBrace >= 0 && lastBrace < s.length - 1) s = s.slice(0, lastBrace + 1);
  try {
    const obj = JSON.parse(s);
    return {
      form_letter: letter,
      title: String(obj.title ?? ""),
      query_id_suggestion: String(obj.query_id_suggestion ?? ""),
      priority: ["concurrent", "pre_bill", "retro", "audit"].includes(obj.priority) ? obj.priority : "concurrent",
      summary_line: String(obj.summary_line ?? ""),
      detail_sections: Array.isArray(obj.detail_sections)
        ? obj.detail_sections
            .filter((s: unknown) => s && typeof s === "object")
            .map((s: { heading?: unknown; body?: unknown }) => ({
              heading: String(s.heading ?? ""),
              body: String(s.body ?? ""),
            }))
            .slice(0, 6)
        : [],
      question: String(obj.question ?? ""),
      options: Array.isArray(obj.options) ? obj.options.filter((o: unknown) => typeof o === "string").slice(0, 6) : [],
      reason: String(obj.reason ?? ""),
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
  const { formLetter, scenario, header } = parsed.data;
  if (!VALID_LETTERS.includes(formLetter as FormLetter)) {
    return NextResponse.json({ error: "Invalid form letter" }, { status: 400 });
  }
  const letter = formLetter as FormLetter;
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

  const systemPrompt = buildFormSystemPrompt(letter);
  const userPrompt = buildFormUserPrompt({ scenario, referenceMaterials });

  let raw: string;
  try {
    raw = await chat({ system: systemPrompt, user: userPrompt, maxTokens: 1800, temperature: 0.15 });
  } catch (e) {
    console.error("LLM call failed:", e);
    return NextResponse.json({ error: "LLM generation failed. Check GROQ_API_KEY." }, { status: 500 });
  }

  const form = safeParseLlmJson(raw, letter);
  const citations = policyChunks.map((c, i) => ({
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
      error: "Could not parse structured response. Try rephrasing the scenario.",
      raw: raw.slice(0, 400),
      citations,
      latencyMs: Date.now() - t0,
    });
  }

  db.auditLog
    .create({
      data: {
        action: "query_form_generate",
        payload: { formType: letter, scenarioPreview: scenario.slice(0, 200), citationsCount: citations.length },
      },
    })
    .catch(() => {});

  return NextResponse.json({
    formType: letter,
    form,
    header: headerInputs,
    citations,
    latencyMs: Date.now() - t0,
    structured: true,
  });
}
