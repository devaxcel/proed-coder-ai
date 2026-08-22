import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { chat } from "@/lib/llm";
import { retrievePolicyChunks } from "@/lib/policy-retrieval";
import { POLICY_DOC_SYSTEM_PROMPT, buildPolicyDocUserPrompt, type PolicyDocOutput } from "@/lib/policy-doc-prompts";

export const runtime = "nodejs";
// This is the largest single generation in the app (a full 20-section
// document) — give it more headroom than the default route timeout.
export const maxDuration = 60;

const Body = z.object({
  topic: z.string().min(5).max(500),
});

function safeParseLlmJson(raw: string): PolicyDocOutput | null {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const firstBrace = s.indexOf("{");
  if (firstBrace > 0) s = s.slice(firstBrace);
  const lastBrace = s.lastIndexOf("}");
  if (lastBrace >= 0 && lastBrace < s.length - 1) s = s.slice(0, lastBrace + 1);
  try {
    const obj = JSON.parse(s);
    const sections = Array.isArray(obj.sections)
      ? obj.sections
          .filter((s: unknown) => s && typeof s === "object")
          .map((s: { number?: unknown; heading?: unknown; body?: unknown }) => ({
            number: typeof s.number === "number" ? s.number : 0,
            heading: String(s.heading ?? ""),
            body: String(s.body ?? ""),
          }))
      : [];
    return {
      policy_title: String(obj.policy_title ?? "Untitled Policy"),
      policy_number_suggestion: String(obj.policy_number_suggestion ?? ""),
      regulatory_basis_summary: String(obj.regulatory_basis_summary ?? ""),
      applies_to: String(obj.applies_to ?? "All coding, CDI, and auditing staff"),
      confidentiality: ["Internal Use", "Confidential", "Restricted"].includes(obj.confidentiality)
        ? obj.confidentiality
        : "Internal Use",
      disclaimer: String(
        obj.disclaimer ??
          "This document is provided for educational and organizational compliance purposes. It does not constitute legal advice."
      ),
      sections,
      citations_used: Array.isArray(obj.citations_used) ? obj.citations_used.filter((n: unknown) => typeof n === "number") : [],
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
  const { topic } = parsed.data;

  // Retrieve more chunks than the Q&A feature since this needs to cover
  // an entire document's worth of ground, not one focused answer.
  let policyChunks: Awaited<ReturnType<typeof retrievePolicyChunks>> = [];
  try {
    policyChunks = await retrievePolicyChunks(topic, 8);
  } catch (e) {
    console.error("Policy retrieval failed:", e);
  }

  // Multiple retrieved chunks often come from the same source document.
  // Deduplicate by policyDocId BEFORE numbering, so the citation numbers
  // the LLM sees (and the references list we render) point to unique
  // sources — not the same document listed 2-3 times under different
  // numbers because 2-3 of its chunks happened to be retrieved.
  const seenDocIds = new Set<string>();
  const uniqueChunks: typeof policyChunks = [];
  for (const chunk of policyChunks) {
    if (!seenDocIds.has(chunk.policyDocId)) {
      seenDocIds.add(chunk.policyDocId);
      uniqueChunks.push(chunk);
    }
  }

  const referenceMaterials = uniqueChunks.map((c) => ({
    title: c.docTitle,
    source: c.sourceName,
    excerpt: c.content.slice(0, 500),
    sourceUrl: c.sourceUrl,
  }));

  const userPrompt = buildPolicyDocUserPrompt({ topic, referenceMaterials });

  let raw: string;
  try {
    raw = await chat({
      system: POLICY_DOC_SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 4000,
      temperature: 0.2,
    });
  } catch (e) {
    console.error("LLM call failed:", e);
    return NextResponse.json({ error: "Generation failed. Check GROQ_API_KEY." }, { status: 500 });
  }

  const policy = safeParseLlmJson(raw);
  const references = uniqueChunks.map((c, i) => ({
    n: i + 1,
    source: c.sourceName,
    docTitle: c.docTitle,
    sourceUrl: c.sourceUrl,
  }));

  if (!policy) {
    return NextResponse.json(
      { error: "Could not parse the generated document. Try a more specific topic.", raw: raw.slice(0, 400) },
      { status: 500 }
    );
  }

  db.auditLog
    .create({
      data: {
        action: "policy_doc_generate",
        payload: { topic: topic.slice(0, 200), sectionCount: policy.sections.length, referencesCount: references.length },
      },
    })
    .catch(() => {});

  return NextResponse.json({
    policy,
    references,
    latencyMs: Date.now() - t0,
  });
}
