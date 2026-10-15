import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/login-security";
import { callProvider } from "@/lib/llm";
import {
  LLM_PROVIDERS, PROVIDER_LABEL, clearLlmTest, readLlmTests, recordLlmTest, resolveLlm, saveStoredLlm, setLlmProvider,
  type LlmProvider, type StoredLlm,
} from "@/lib/llm-config";

export const runtime = "nodejs";
export const maxDuration = 60;

async function requireAdmin() {
  const session = await auth();
  const user = session?.user as { role?: string; id?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return null;
  return user;
}
const isProvider = (v: unknown): v is LlmProvider => typeof v === "string" && (LLM_PROVIDERS as string[]).includes(v);
const TEST_VALID_MINUTES = 60;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const cfg = await resolveLlm();
  const tests = await readLlmTests();
  const providers = Object.fromEntries(
    LLM_PROVIDERS.map((p) => [p, {
      label: PROVIDER_LABEL[p],
      configured: !!cfg.keys[p],
      source: cfg.src[p],
      model: cfg.models[p],
      testedRecently: !!tests[p] && Date.now() - new Date(tests[p]!).getTime() < TEST_VALID_MINUTES * 60_000,
    }]),
  );
  return NextResponse.json({ active: cfg.provider, activeSource: cfg.providerSource, providers, encryptionReady: !!process.env.MFA_ENCRYPTION_KEY });
}

/** Choose which provider the whole app uses. It must have a key and a recent successful test. */
export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { provider } = (await req.json().catch(() => ({}))) as { provider?: string };
  if (!isProvider(provider)) return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  const cfg = await resolveLlm();
  if (!cfg.keys[provider]) return NextResponse.json({ error: `${PROVIDER_LABEL[provider]} has no API key yet. Enter it and save first.` }, { status: 400 });
  if (cfg.provider !== provider) {
    const t = (await readLlmTests())[provider];
    if (!t || Date.now() - new Date(t).getTime() > TEST_VALID_MINUTES * 60_000) {
      return NextResponse.json({ error: `Run “Test ${PROVIDER_LABEL[provider]}” first and confirm it works, then switch. This prevents breaking the AI features with a wrong key.` }, { status: 400 });
    }
  }
  await setLlmProvider(provider, admin.id ?? null);
  if (cfg.provider !== provider) await audit("llm_provider_changed", admin.id ?? null, { from: cfg.provider, to: provider });
  return NextResponse.json({ ok: true, provider });
}

/** Make one tiny live call with the provider's saved key + model, without switching the app to it. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { provider } = (await req.json().catch(() => ({}))) as { provider?: string };
  if (!isProvider(provider)) return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  const cfg = await resolveLlm();
  const key = cfg.keys[provider];
  if (!key) return NextResponse.json({ error: `${PROVIDER_LABEL[provider]} has no API key yet. Enter it and save first.` }, { status: 400 });
  try {
    const reply = await callProvider(provider, key, cfg.models[provider], {
      system: "You are a connection test. Reply with the single word OK.",
      user: "Reply with OK.",
      maxTokens: 64,
      temperature: 0,
    });
    await recordLlmTest(provider, true, admin.id ?? null);
    return NextResponse.json({ ok: true, model: cfg.models[provider], reply: reply.trim().slice(0, 40) });
  } catch (e) {
    await recordLlmTest(provider, false, admin.id ?? null).catch(() => {});
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `The test failed: ${msg.slice(0, 300)}` }, { status: 502 });
  }
}

/**
 * Save API key / model name entered in the app (stored encrypted; never returned to the browser).
 * Body: { groq?|anthropic?|openai?: {apiKey?, model?}, clear?: provider }. Empty fields keep the saved value.
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  if (!process.env.MFA_ENCRYPTION_KEY) {
    return NextResponse.json({ error: "Keys can't be stored securely: MFA_ENCRYPTION_KEY is not set on the server." }, { status: 400 });
  }
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clear = isProvider(b.clear) ? b.clear : null;
  const patch: StoredLlm = {};
  const touched: LlmProvider[] = [];
  for (const p of LLM_PROVIDERS) {
    const sec = b[p] as { apiKey?: unknown; model?: unknown } | undefined;
    const apiKey = typeof sec?.apiKey === "string" ? sec.apiKey.trim().slice(0, 400) : "";
    const model = typeof sec?.model === "string" ? sec.model.trim().slice(0, 100) : "";
    if (model && !/^[\w.:\-/]+$/.test(model)) return NextResponse.json({ error: "The model name contains characters that aren't allowed." }, { status: 400 });
    if (apiKey && /\s/.test(apiKey)) return NextResponse.json({ error: "The API key must not contain spaces." }, { status: 400 });
    if (apiKey) patch[`${p}ApiKey`] = apiKey;
    if (model) patch[`${p}Model`] = model;
    if (apiKey || model) touched.push(p);
  }
  try {
    await saveStoredLlm(patch, clear, admin.id ?? null);
  } catch {
    return NextResponse.json({ error: "Could not save the settings." }, { status: 500 });
  }
  for (const p of touched) await clearLlmTest(p, admin.id ?? null).catch(() => {}); // changed → must be re-tested
  if (clear) await clearLlmTest(clear, admin.id ?? null).catch(() => {});
  await audit("llm_settings_changed", admin.id ?? null, { fields: Object.keys(patch), cleared: clear }); // names only — never values
  return NextResponse.json({ ok: true });
}
