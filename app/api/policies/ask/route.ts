import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { chat } from "@/lib/llm";
import { retrievePolicyChunks } from "@/lib/policy-retrieval";
import {
  POLICY_QA_SYSTEM_PROMPT,
  buildPolicyQAUserPrompt,
} from "@/lib/policy-qa-prompts";

export const runtime = "nodejs";

const Body = z.object({
  question: z.string().min(3).max(2000),
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

type LlmResponse = {
  answer: string;
  citations_used?: number[];
  confidence?: "high" | "medium" | "low";
  suggestion?: string;
};

function safeParseLlmJson(raw: string): LlmResponse | null {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const firstBrace = s.indexOf("{");
  if (firstBrace > 0) s = s.slice(firstBrace);
  const lastBrace = s.lastIndexOf("}");
  if (lastBrace >= 0 && lastBrace < s.length - 1) s = s.slice(0, lastBrace + 1);
  try {
    const obj = JSON.parse(s);
    if (typeof obj.answer !== "string") return null;
    return {
      answer: obj.answer,
      citations_used: Array.isArray(obj.citations_used)
        ? obj.citations_used.filter((x: unknown) => typeof x === "number")
        : [],
      confidence: ["high", "medium", "low"].includes(obj.confidence)
        ? obj.confidence
        : "medium",
      suggestion: typeof obj.suggestion === "string" ? obj.suggestion : "",
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
  const { question } = parsed.data;

  // Retrieve top 5 policy chunks (slightly more than query-form gets, for broader coverage)
  let policyChunks: Awaited<ReturnType<typeof retrievePolicyChunks>> = [];
  try {
    policyChunks = await retrievePolicyChunks(question, 5);
  } catch (e) {
    console.error("Policy retrieval failed:", e);
    return NextResponse.json(
      { error: "Policy retrieval failed. Try again." },
      { status: 500 }
    );
  }

  const referenceMaterials = policyChunks.map((c) => ({
    title: c.docTitle,
    source: c.sourceName,
    excerpt: c.content.slice(0, 500),
  }));

  const userPrompt = buildPolicyQAUserPrompt({ question, referenceMaterials });

  let raw: string;
  try {
    raw = await chat({
      system: POLICY_QA_SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 1500,
      temperature: 0.15,
    });
  } catch (e) {
    console.error("LLM call failed:", e);
    return NextResponse.json(
      { error: "LLM generation failed. Check GROQ_API_KEY." },
      { status: 500 }
    );
  }

  const parsedResponse = safeParseLlmJson(raw);

  const citations: Citation[] = policyChunks.map((c, i) => ({
    n: i + 1,
    chunkId: c.chunkId,
    policyDocId: c.policyDocId,
    source: c.sourceName,
    docTitle: c.docTitle,
    sourceUrl: c.sourceUrl,
    excerpt: c.content.slice(0, 400),
  }));

  if (!parsedResponse) {
    return NextResponse.json({
      answer: raw,
      citations,
      citationsUsed: [],
      confidence: "low",
      suggestion: "",
      latencyMs: Date.now() - t0,
      structured: false,
    });
  }

  // Best-effort audit log
  db.auditLog
    .create({
      data: {
        action: "policy_qa",
        payload: {
          questionPreview: question.slice(0, 200),
          citationsCount: citations.length,
          confidence: parsedResponse.confidence,
        },
      },
    })
    .catch(() => {});

  return NextResponse.json({
    answer: parsedResponse.answer,
    citations,
    citationsUsed: parsedResponse.citations_used ?? [],
    confidence: parsedResponse.confidence ?? "medium",
    suggestion: parsedResponse.suggestion ?? "",
    latencyMs: Date.now() - t0,
    structured: true,
  });
}
