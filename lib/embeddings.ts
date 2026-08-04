/**
 * ProEd Coder AI — Multi-provider embedding library.
 *
 * Providers (choose via EMBEDDING_PROVIDER env var):
 *
 *   - "xenova"      — local, free, ~200ms per query. Works on Railway (persistent
 *                     process) and local dev. NOT suitable for Vercel serverless
 *                     because model file (~130 MB) downloads on cold start.
 *
 *   - "huggingface" — hosted API. Uses the SAME bge-small-en-v1.5 model as Xenova,
 *                     so vectors are 100% compatible with existing seeded data.
 *                     Free tier: ~1000 req/day. Perfect fit for Vercel Hobby.
 *
 *   - "openai"      — text-embedding-3-small, truncated to 384 dims via `dimensions`
 *                     parameter. Different embedding space than Xenova/HF; using
 *                     openai at query time against xenova-seeded data will produce
 *                     nonsense results. Only use if you re-seed everything.
 *
 * All three produce 384-dim vectors so they slot into the same pgvector column.
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
