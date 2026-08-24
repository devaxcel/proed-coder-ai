import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chat } from "@/lib/llm";
import { retrievePolicyChunks } from "@/lib/policy-retrieval";
import { CLAIM_VALIDATION_SYSTEM_PROMPT, buildClaimValidationUserPrompt, type ClaimValidationOutput } from "@/lib/claim-validation-prompts";

export const runtime = "nodejs";

const Body = z.object({
  claimDescription: z.string().min(10).max(3000),
});

function safeParseLlmJson(raw: string): ClaimValidationOutput | null {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const firstBrace = s.indexOf("{");
  if (firstBrace > 0) s = s.slice(firstBrace);
  const lastBrace = s.lastIndexOf("}");
  if (lastBrace >= 0 && lastBrace < s.length - 1) s = s.slice(0, lastBrace + 1);
  try {
    const obj = JSON.parse(s);
    return {
      summary: String(obj.summary ?? ""),
      cpt_validation_note: String(
        obj.cpt_validation_note ?? "CPT-specific validation is unavailable pending ProEd's AMA CPT license."
      ),
      findings: Array.isArray(obj.findings)
        ? obj.findings
            .filter((f: unknown) => f && typeof f === "object")
            .map((f: { area?: unknown; concern?: unknown; citation?: unknown; severity?: unknown }) => ({
              area: String(f.area ?? ""),
              concern: String(f.concern ?? ""),
              citation: String(f.citation ?? ""),
              severity: ["info", "review_needed", "likely_issue"].includes(f.severity as string) ? f.severity : "info",
            }))
        : [],
      not_reviewable: String(obj.not_reviewable ?? "CPT-specific code/modifier validation (pending AMA license)."),
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
  const { claimDescription } = parsed.data;

  let policyChunks: Awaited<ReturnType<typeof retrievePolicyChunks>> = [];
  try {
    policyChunks = await retrievePolicyChunks(claimDescription, 6);
  } catch (e) {
    console.error("Policy retrieval failed:", e);
  }

  const referenceMaterials = policyChunks.map((c) => ({
    title: c.docTitle,
    source: c.sourceName,
    excerpt: c.content.slice(0, 400),
  }));

  const userPrompt = buildClaimValidationUserPrompt({ claimDescription, referenceMaterials });

  let raw: string;
  try {
    raw = await chat({
      system: CLAIM_VALIDATION_SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 1500,
      temperature: 0.15,
    });
  } catch (e) {
    console.error("LLM call failed:", e);
    return NextResponse.json({ error: "Validation failed. Check GROQ_API_KEY." }, { status: 500 });
  }

  const result = safeParseLlmJson(raw);
  const citations = policyChunks.map((c, i) => ({
    n: i + 1,
    source: c.sourceName,
    docTitle: c.docTitle,
    sourceUrl: c.sourceUrl,
  }));

  if (!result) {
    return NextResponse.json({ error: "Could not parse validation response. Try again.", raw: raw.slice(0, 300) }, { status: 500 });
  }

  return NextResponse.json({ result, citations, latencyMs: Date.now() - t0 });
}
