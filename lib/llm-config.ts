/**
 * AI model settings — which LLM provider the app uses, and its API key / model name.
 *
 * Admins set these in Admin > AI Model. API keys are stored ENCRYPTED in the database (AES-256-GCM with
 * MFA_ENCRYPTION_KEY, same as the email settings) and are never sent back to the browser.
 * A value saved in the app wins over the matching Vercel environment variable, so the old setup
 * (LLM_PROVIDER, GROQ_API_KEY, ANTHROPIC_API_KEY, GROQ_MODEL, CLAUDE_MODEL) keeps working as the fallback.
 */
import { db } from "./db";
import { decryptSecret, encryptSecret } from "./mfa";

export type LlmProvider = "groq" | "anthropic" | "openai";
export const LLM_PROVIDERS: LlmProvider[] = ["groq", "anthropic", "openai"];
export const LLM_CONFIG_KEY = "llmConfig";
export const LLM_PROVIDER_KEY = "llmProvider";
export const LLM_TEST_KEY = "llmTestOk"; // JSON { [provider]: ISO time of last successful test }

export const DEFAULT_MODEL: Record<LlmProvider, string> = {
  groq: "openai/gpt-oss-120b",
  anthropic: "claude-sonnet-4-5-20250929",
  openai: "gpt-4.1-mini",
};
export const PROVIDER_LABEL: Record<LlmProvider, string> = { groq: "Groq", anthropic: "Claude (Anthropic)", openai: "OpenAI" };

export type StoredLlm = Partial<Record<`${LlmProvider}ApiKey` | `${LlmProvider}Model`, string>>;

async function readStored(): Promise<StoredLlm> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: LLM_CONFIG_KEY } });
    if (!row) return {};
    return JSON.parse(decryptSecret(row.value)) as StoredLlm;
  } catch {
    return {}; // table/key missing or unreadable → environment variables
  }
}

export async function saveStoredLlm(patch: StoredLlm, clear: LlmProvider | null, updatedBy: string | null) {
  const next: StoredLlm = { ...(await readStored()) };
  if (clear) { delete next[`${clear}ApiKey`]; delete next[`${clear}Model`]; }
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v === "string" && v.trim() !== "") (next as Record<string, string>)[k] = v.trim();
  }
  const value = encryptSecret(JSON.stringify(next)); // throws if MFA_ENCRYPTION_KEY is missing
  await db.appSetting.upsert({
    where: { key: LLM_CONFIG_KEY },
    create: { key: LLM_CONFIG_KEY, value, updatedBy },
    update: { value, updatedBy },
  });
  cache = null;
}

export async function setLlmProvider(p: LlmProvider, updatedBy: string | null) {
  await db.appSetting.upsert({
    where: { key: LLM_PROVIDER_KEY },
    create: { key: LLM_PROVIDER_KEY, value: p, updatedBy },
    update: { value: p, updatedBy },
  });
  cache = null;
}

export async function readLlmTests(): Promise<Partial<Record<LlmProvider, string>>> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: LLM_TEST_KEY } });
    return row ? JSON.parse(row.value) : {};
  } catch { return {}; }
}
export async function recordLlmTest(p: LlmProvider, ok: boolean, updatedBy: string | null) {
  const cur = await readLlmTests();
  if (ok) cur[p] = new Date().toISOString(); else delete cur[p];
  const value = JSON.stringify(cur);
  await db.appSetting.upsert({ where: { key: LLM_TEST_KEY }, create: { key: LLM_TEST_KEY, value, updatedBy }, update: { value, updatedBy } });
}
export async function clearLlmTest(p: LlmProvider, updatedBy: string | null) { await recordLlmTest(p, false, updatedBy); }

export type LlmEffective = {
  provider: LlmProvider;
  keys: Record<LlmProvider, string | undefined>;
  models: Record<LlmProvider, string>;
  src: Record<LlmProvider, "app" | "env" | null>;
  providerSource: "app" | "env" | "default";
};

let cache: { at: number; val: LlmEffective } | null = null;
const CACHE_MS = 30_000; // saved changes reach every server instance within ~30 seconds

export async function resolveLlm(): Promise<LlmEffective> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.val;
  const st = await readStored();
  const e = process.env;
  let chosen: string | null = null;
  try { chosen = (await db.appSetting.findUnique({ where: { key: LLM_PROVIDER_KEY } }))?.value ?? null; } catch { chosen = null; }
  const envP = (e.LLM_PROVIDER ?? "").toLowerCase();
  const provider = ((LLM_PROVIDERS as string[]).includes(chosen ?? "") ? chosen : (LLM_PROVIDERS as string[]).includes(envP) ? envP : "groq") as LlmProvider;
  const envKey: Record<LlmProvider, string | undefined> = { groq: e.GROQ_API_KEY, anthropic: e.ANTHROPIC_API_KEY, openai: e.OPENAI_API_KEY };
  const envModel: Record<LlmProvider, string | undefined> = { groq: e.GROQ_MODEL, anthropic: e.CLAUDE_MODEL, openai: e.OPENAI_MODEL };
  const keys = {} as LlmEffective["keys"], models = {} as LlmEffective["models"], src = {} as LlmEffective["src"];
  for (const p of LLM_PROVIDERS) {
    keys[p] = st[`${p}ApiKey`] || envKey[p] || undefined;
    models[p] = st[`${p}Model`] || envModel[p] || DEFAULT_MODEL[p];
    src[p] = st[`${p}ApiKey`] ? "app" : envKey[p] ? "env" : null;
  }
  const val: LlmEffective = { provider, keys, models, src, providerSource: (LLM_PROVIDERS as string[]).includes(chosen ?? "") ? "app" : envP ? "env" : "default" };
  cache = { at: Date.now(), val };
  return val;
}
