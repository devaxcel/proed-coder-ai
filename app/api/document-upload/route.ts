import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/llm";
import { CODE_CHECK_SYSTEM_PROMPT, buildCodeCheckUserPrompt } from "@/lib/code-check-prompts";

export const runtime = "nodejs";

// Generous cap for an uploaded document — much higher than the paste-in
// textarea's limit, since real chart notes/records can run long. Still
// capped to keep LLM token cost and latency bounded.
const MAX_CHARS = 20000;

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

// Strips leftover page-separator artifacts some PDF extractors emit,
// which are formatting noise, not document content, and would otherwise
// confuse the LLM by looking like part of the note.
function cleanExtractedText(text: string): string {
  return text.replace(/--\s*\d+\s*of\s*\d+\s*--/g, "").trim();
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const codeSystem = formData.get("codeSystem") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (codeSystem !== "ICD-10" && codeSystem !== "HCPCS" && codeSystem !== "CPT") {
    return NextResponse.json({ error: "Invalid code system" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let extractedText = "";

  try {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      extractedText = cleanExtractedText(text);
    } else {
      // Treat anything else as plain text
      extractedText = buffer.toString("utf-8");
    }
  } catch (e) {
    console.error("File extraction failed:", e);
    return NextResponse.json({ error: "Could not read this file. Please upload a PDF or plain text file." }, { status: 400 });
  }

  if (!extractedText || extractedText.trim().length < 10) {
    return NextResponse.json({ error: "No readable text found in this file." }, { status: 400 });
  }

  let truncated = false;
  if (extractedText.length > MAX_CHARS) {
    extractedText = extractedText.slice(0, MAX_CHARS);
    truncated = true;
  }

  let raw: string;
  try {
    raw = await chat({
      system: CODE_CHECK_SYSTEM_PROMPT(codeSystem),
      user: buildCodeCheckUserPrompt(extractedText),
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

  return NextResponse.json({
    ...result,
    extractedTextPreview: extractedText.slice(0, 500),
    extractedCharCount: extractedText.length,
    truncated,
    fileName: file.name,
  });
}
