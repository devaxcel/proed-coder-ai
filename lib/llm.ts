/**
 * Provider-agnostic LLM interface.
 *
 * The provider, API keys and model names are set by an Admin in Admin > AI Model (stored encrypted in the database).
 * Environment variables (LLM_PROVIDER, GROQ_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, GROQ_MODEL, CLAUDE_MODEL,
 * OPENAI_MODEL) are still honoured as the fallback — see lib/llm-config.ts.
 *
 * Public functions (unchanged): classifyIntent(query), chat({system,user,maxTokens,temperature}).
 */

import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { resolveLlm, PROVIDER_LABEL, type LlmProvider } from "./llm-config";

export type Intent = "codes" | "query_form" | "policy";

const CLASSIFIER_SYSTEM =
  "You are a router for a medical coding assistant. Classify the user query into exactly ONE label:\n" +
  "- `codes`: they want ICD-10, HCPCS, or CPT codes (diagnoses, procedures, supplies)\n" +
  "- `query_form`: they want to draft or find a physician query form\n" +
  "- `policy`: they want a policy document, guideline, or measure specification\n\n" +
  "Respond with only the label, nothing else.";

type Call = { system: string; user: string; maxTokens: number; temperature: number };

/** One completion with an explicit provider/key/model — used by chat() and by the Admin "Test" button. */
export async function callProvider(provider: LlmProvider, apiKey: string, model: string, c: Call): Promise<string> {
  if (provider === "groq") {
    const groq = new Groq({ apiKey });
    const res = await groq.chat.completions.create({
      model,
      messages: [{ role: "system", content: c.system }, { role: "user", content: c.user }],
      max_tokens: c.maxTokens,
      temperature: c.temperature,
    });
    return res.choices[0]?.message?.content ?? "";
  }
  if (provider === "anthropic") {
    const anthropic = new Anthropic({ apiKey });
    const res = await anthropic.messages.create({
      model,
      max_tokens: c.maxTokens,
      temperature: c.temperature,
      system: c.system,
      messages: [{ role: "user", content: c.user }],
    });
    return res.content.find((x) => x.type === "text")?.text ?? "";
  }
  // OpenAI — plain HTTPS call, no extra package. Newer reasoning models (gpt-5*, o*) reject a custom temperature.
  const fixedTemp = /^(gpt-5|o\d)/i.test(model);
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: c.system }, { role: "user", content: c.user }],
      max_completion_tokens: c.maxTokens,
      ...(fixedTemp ? {} : { temperature: c.temperature }),
    }),
  });
  const j = (await r.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (!r.ok) throw new Error(j.error?.message ?? `OpenAI error ${r.status}`);
  return j.choices?.[0]?.message?.content ?? "";
}

async function active() {
  const cfg = await resolveLlm();
  const key = cfg.keys[cfg.provider];
  if (!key) {
    throw new Error(`AI model "${PROVIDER_LABEL[cfg.provider]}" has no API key. An Admin can add it in Admin > AI Model.`);
  }
  return { provider: cfg.provider, key, model: cfg.models[cfg.provider] };
}

/** Classify a coder's natural-language query into a track. */
export async function classifyIntent(query: string): Promise<Intent> {
  const a = await active();
  const raw = (await callProvider(a.provider, a.key, a.model, { system: CLASSIFIER_SYSTEM, user: query, maxTokens: 16, temperature: 0 }))
    .trim()
    .toLowerCase() || "codes";
  if (raw.startsWith("query")) return "query_form";
  if (raw.startsWith("policy")) return "policy";
  return "codes";
}

/** Low-level chat completion — same signature across providers. */
export async function chat(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const a = await active();
  return callProvider(a.provider, a.key, a.model, {
    system: opts.system,
    user: opts.user,
    maxTokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.2,
  });
}
