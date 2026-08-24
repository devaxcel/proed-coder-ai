import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chat } from "@/lib/llm";
import { CODE_CHECK_SYSTEM_PROMPT, buildCodeCheckUserPrompt } from "@/lib/code-check-prompts";

export const runtime = "nodejs";

const Body = z.object({
  noteText: z.string().min(10).max(6000),
  codeSystem: z.enum(["ICD-10", "HCPCS", "CPT"]),
});

type CheckResult = {
  supported_codes: { code_hint: string; description: string; evidence: string }[];
  possible_codes_needing_more_documentation: {
    code_hint: string;
    description: string;
    why_flagged: string;
    documentation_needed: string;
  }[];
  overall_note: string;
};

function safeParseLlmJson(raw: string): CheckResult | null {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const firstBrace = s.indexOf("{");
  if (firstBrace > 0) s = s.slice(firstBrace);
  const lastBrace = s.lastIndexOf("}");
  if (lastBrace >= 0 && lastBrace < s.length - 1) s = s.slice(0, lastBrace + 1);
  try {
    const obj = JSON.parse(s);
    return {
      supported_codes: Array.isArray(obj.supported_codes) ? obj.supported_codes : [],
      possible_codes_needing_more_documentation: Array.isArray(obj.possible_codes_needing_more_documentation)
        ? obj.possible_codes_needing_more_documentation
        : [],
      overall_note: typeof obj.overall_note === "string" ? obj.overall_note : "",
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { noteText, codeSystem } = parsed.data;

  let raw: string;
  try {
    raw = await chat({
      system: CODE_CHECK_SYSTEM_PROMPT(codeSystem),
      user: buildCodeCheckUserPrompt(noteText),
      maxTokens: 1500,
      temperature: 0.15,
    });
  } catch (e) {
    console.error("LLM call failed:", e);
    return NextResponse.json({ error: "Analysis failed. Check GROQ_API_KEY." }, { status: 500 });
  }

  const result = safeParseLlmJson(raw);
  if (!result) {
    return NextResponse.json({ error: "Could not parse analysis. Try again.", raw: raw.slice(0, 300) }, { status: 500 });
  }

  return NextResponse.json(result);
}
