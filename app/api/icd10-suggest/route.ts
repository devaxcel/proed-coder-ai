import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Lightweight type-ahead for ICD-10-CM pickers (MEAT HCC, Annual Wellness).
 * Combines two sources, both read-only and fast (no embeddings / LLM):
 *   1. Code table  — code prefix ("E11.4") or description words ("diabetes neuropathy")
 *   2. Alphabetic Index — main-term search ("diabetes, type 2") → the code(s) it points to
 * Only codes that exist in the ICD10CM table are returned, so every pick is a real code.
 * NOTE: the DB stores ICD-10 codes WITHOUT the decimal point (E1140).
 */

export type Icd10Suggestion = {
  code: string; // dotted for display / entry, e.g. "E11.40"
  description: string;
  billable: boolean;
  via: "code" | "index";
  indexTerm?: string;
};

const dot = (c: string) => (c.length > 3 && !c.includes(".") ? c.slice(0, 3) + "." + c.slice(3) : c);
const undot = (c: string) => c.replace(/[.\s]/g, "").toUpperCase();

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });

  const compact = undot(q);
  const looksLikeCode = /^[A-Z][0-9][0-9A-Z]{0,5}$/.test(compact);
  const words = q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2).slice(0, 5);

  try {
    const [byCode, byDesc, byIndex] = await Promise.all([
      looksLikeCode
        ? db.medicalCode.findMany({
            where: { codeSystem: "ICD10CM", code: { startsWith: compact } },
            orderBy: { code: "asc" },
            take: 12,
            select: { code: true, description: true, isBillable: true },
          })
        : Promise.resolve([]),
      !looksLikeCode && words.length
        ? db.medicalCode.findMany({
            where: { codeSystem: "ICD10CM", AND: words.map((w) => ({ description: { contains: w, mode: "insensitive" as const } })) },
            orderBy: [{ isBillable: "desc" }, { code: "asc" }],
            take: 12,
            select: { code: true, description: true, isBillable: true },
          })
        : Promise.resolve([]),
      !looksLikeCode && words.length
        ? db.icdAlphabeticIndexEntry.findMany({
            where: {
              code: { not: null },
              AND: words.map((w) => ({ fullPath: { contains: w, mode: "insensitive" as const } })),
            },
            orderBy: [{ term: "asc" }],
            take: 15,
            select: { code: true, term: true, fullPath: true },
          })
        : Promise.resolve([]),
    ]);

    const out = new Map<string, Icd10Suggestion>();
    for (const r of [...byCode, ...byDesc]) {
      out.set(r.code, { code: dot(r.code), description: r.description, billable: r.isBillable, via: "code" });
    }

    // Index entries → resolve their codes against the ICD10CM table
    const idxCodes = Array.from(
      new Set(byIndex.map((e) => undot(e.code ?? "")).filter((c) => /^[A-TV-Z][0-9][0-9AB][0-9A-TV-Z]{0,4}$/.test(c)))
    );
    if (idxCodes.length) {
      const rows = await db.medicalCode.findMany({
        where: { codeSystem: "ICD10CM", code: { in: idxCodes } },
        select: { code: true, description: true, isBillable: true },
      });
      for (const e of byIndex) {
        const c = undot(e.code ?? "");
        const row = rows.find((r) => r.code === c);
        if (row && !out.has(c)) out.set(c, { code: dot(c), description: row.description, billable: row.isBillable, via: "index", indexTerm: e.fullPath });
      }
    }

    return NextResponse.json({ results: Array.from(out.values()).slice(0, 15) });
  } catch (e) {
    console.error("[icd10-suggest]", e);
    return NextResponse.json({ results: [], error: "Lookup unavailable" }, { status: 200 });
  }
}
