/**
 * ProEd Coder AI — Multi-provider embedding library.
 *
 * Providers (choose via EMBEDDING_PROVIDER env var):
 *
 *   - "xenova"      — local, free, ~200ms per query. Works on Railway (persistent
 *                     process) and local dev. NOT suitable for Vercel serverless
 *                     because model file (~130 MB) downloads on cold start.
 *
 *   - "gemini"      — hosted API, Google's gemini-embedding-001 model, truncated
 *                     to 384 dims via outputDimensionality. Free, no card required
 *                     (Google AI Studio API key). THIS IS THE CURRENT PRODUCTION
 *                     PROVIDER for Vercel — set EMBEDDING_PROVIDER=gemini and
 *                     GEMINI_API_KEY there. Different embedding space than
 *                     Xenova/HF, so any content embedded by Xenova/HF must be
 *                     RE-SEEDED with EMBEDDING_PROVIDER=gemini before query-time
 *                     Gemini vectors will match it (mixing spaces produces
 *                     meaningless similarity scores).
 *
 *   - "huggingface" — hosted API. Uses the SAME bge-small-en-v1.5 model as Xenova,
 *                     so vectors are 100% compatible with existing Xenova-seeded
 *                     data. Kept for reference — HF's free tier is no longer
 *                     usable (see lib/embeddings.ts history); gemini replaced it.
 *
 *   - "openai"      — text-embedding-3-small, truncated to 384 dims via `dimensions`
 *                     parameter. Different embedding space than Xenova/HF/Gemini;
 *                     only use if you re-seed everything. Not currently used —
 *                     kept available, ruled out on cost grounds.
 *
 * All providers produce 384-dim vectors so they slot into the same pgvector
 * column without any schema change.
 */

import type { FeatureExtractionPipeline } from "@huggingface/transformers";

let xenovaPipeline: FeatureExtractionPipeline | null = null;

const PROVIDER = (process.env.EMBEDDING_PROVIDER ?? "xenova").toLowerCase();
export const CURRENT_PROVIDER = PROVIDER;

const HF_MODEL = "BAAI/bge-small-en-v1.5";
const XENOVA_MODEL = "Xenova/bge-small-en-v1.5";

// ------------------------------------------------------------------
// Xenova (local)
// ------------------------------------------------------------------

async function getXenova(): Promise<FeatureExtractionPipeline> {
  if (xenovaPipeline) return xenovaPipeline;
  const { pipeline } = await import("@huggingface/transformers");
  xenovaPipeline = (await pipeline(
    "feature-extraction",
    XENOVA_MODEL
  )) as unknown as FeatureExtractionPipeline;
  return xenovaPipeline;
}

async function embedXenova(text: string): Promise<number[]> {
  const pipe = await getXenova();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output: any = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

async function embedBatchXenova(texts: string[]): Promise<number[][]> {
  const pipe = await getXenova();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output: any = await pipe(texts, { pooling: "mean", normalize: true });
  const dims = output.dims[output.dims.length - 1] as number;
  const data = output.data as Float32Array;
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    results.push(Array.from(data.slice(i * dims, (i + 1) * dims)));
  }
  return results;
}

// ------------------------------------------------------------------
// HuggingFace Inference API (hosted, same model as Xenova)
// ------------------------------------------------------------------

const HF_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}/pipeline/feature-extraction`;

async function embedHuggingFace(text: string): Promise<number[]> {
  const token = process.env.HUGGINGFACE_API_KEY;
  if (!token) {
    throw new Error(
      "HUGGINGFACE_API_KEY is required when EMBEDDING_PROVIDER=huggingface"
    );
  }
  const res = await fetch(HF_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: text,
      options: { wait_for_model: true },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HuggingFace API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  // For single input, bge-small-en-v1.5 returns a 1D array of 384 floats.
  // Some models return [[...]] — be defensive.
  if (Array.isArray(data[0])) return data[0] as number[];
  return data as number[];
}

async function embedBatchHuggingFace(texts: string[]): Promise<number[][]> {
  const token = process.env.HUGGINGFACE_API_KEY;
  if (!token) {
    throw new Error(
      "HUGGINGFACE_API_KEY is required when EMBEDDING_PROVIDER=huggingface"
    );
  }
  // HF supports batch inputs; chunk to 16 for safety
  const CHUNK = 16;
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += CHUNK) {
    const chunk = texts.slice(i, i + CHUNK);
    const res = await fetch(HF_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: chunk,
        options: { wait_for_model: true },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HuggingFace API ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as number[][];
    for (const vec of data) results.push(vec);
  }
  return results;
}

// ------------------------------------------------------------------
// Gemini (Google AI Studio) — gemini-embedding-001, truncated to 384 dims
// ------------------------------------------------------------------

const GEMINI_MODEL = "gemini-embedding-001";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent`;
const GEMINI_BATCH_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:batchEmbedContents`;

async function embedGemini(text: string): Promise<number[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is required when EMBEDDING_PROVIDER=gemini");
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: `models/${GEMINI_MODEL}`,
      content: { parts: [{ text }] },
      embedContentConfig: { outputDimensionality: 384 },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API ${res.status}: ${body.slice(0, 300)}`);
  }
  const j = await res.json();
  return j.embedding.values as number[];
}

async function embedBatchGemini(texts: string[]): Promise<number[][]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is required when EMBEDDING_PROVIDER=gemini");
  // Chunk to keep each batch request payload reasonable.
  const CHUNK = 20;
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += CHUNK) {
    const chunk = texts.slice(i, i + CHUNK);
    const res = await fetch(GEMINI_BATCH_URL, {
      method: "POST",
      headers: {
        "x-goog-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: chunk.map((text) => ({
          model: `models/${GEMINI_MODEL}`,
          content: { parts: [{ text }] },
          embedContentConfig: { outputDimensionality: 384 },
        })),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini API ${res.status}: ${body.slice(0, 300)}`);
    }
    const j = await res.json();
    for (const e of j.embeddings as Array<{ values: number[] }>) {
      results.push(e.values);
    }
  }
  return results;
}

// ------------------------------------------------------------------
// OpenAI (text-embedding-3-small, truncated to 384 dims)
// ------------------------------------------------------------------

async function embedOpenAI(text: string): Promise<number[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY required when EMBEDDING_PROVIDER=openai");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      model: "text-embedding-3-small",
      dimensions: 384,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.data[0].embedding as number[];
}

async function embedBatchOpenAI(texts: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY required when EMBEDDING_PROVIDER=openai");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model: "text-embedding-3-small",
      dimensions: 384,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.data.map((d: { embedding: number[] }) => d.embedding);
}

// ------------------------------------------------------------------
// Public interface
// ------------------------------------------------------------------

export async function embed(text: string): Promise<number[]> {
  switch (PROVIDER) {
    case "gemini":
      return embedGemini(text);
    case "huggingface":
      return embedHuggingFace(text);
    case "openai":
      return embedOpenAI(text);
    case "xenova":
    default:
      return embedXenova(text);
  }
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  switch (PROVIDER) {
    case "gemini":
      return embedBatchGemini(texts);
    case "huggingface":
      return embedBatchHuggingFace(texts);
    case "openai":
      return embedBatchOpenAI(texts);
    case "xenova":
    default:
      return embedBatchXenova(texts);
  }
}

export function toPgVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
