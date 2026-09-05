import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const VALID_YEARS = ["2024", "2025", "2026"] as const;
type Year = (typeof VALID_YEARS)[number];

function getModel(year: Year) {
  if (year === "2024") return db.icdHccMapping2024;
  if (year === "2025") return db.icdHccMapping2025;
  return db.icdHccMapping2026;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
  const yearParam = req.nextUrl.searchParams.get("year") ?? "2026";
  const year = (VALID_YEARS as readonly string[]).includes(yearParam) ? (yearParam as Year) : "2026";
  const pageSize = 25;

  if (!q) {
    return NextResponse.json({ results: [], total: 0, page, pageSize, year });
  }

  const where = {
    OR: [
      { icd10Code: { contains: q, mode: "insensitive" as const } },
      { description: { contains: q, mode: "insensitive" as const } },
    ],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = getModel(year) as any;
  const [results, total] = await Promise.all([
    model.findMany({
      where,
      orderBy: { icd10Code: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    model.count({ where }),
  ]);

  // Enrich with rich detail notes where available — both tables use
  // dot-stripped codes already (e.g. "E1122"), so no conversion needed.
  const codes = results.map((r: { icd10Code: string }) => r.icd10Code);
  const richDetails = codes.length
    ? await db.icd10RichDetail.findMany({
        where: { code: { in: codes } },
        select: { code: true, includes: true, excludes1: true, excludes2: true, codeFirst: true, useAdditionalCode: true, codeAlso: true, parentCode: true },
      })
    : [];
  const richByCode = new Map(richDetails.map((r) => [r.code, r]));

  // Also fetch the immediate parent's notes (e.g. E11's Excludes1 for a
  // code like E1122) — matches the "Parent Code Notes" section Codify shows.
  const parentCodes = [...new Set(richDetails.map((r) => r.parentCode).filter((p): p is string => !!p))];
  const parentDetails = parentCodes.length
    ? await db.icd10RichDetail.findMany({
        where: { code: { in: parentCodes } },
        select: { code: true, description: true, includes: true, excludes1: true, excludes2: true, useAdditionalCode: true },
      })
    : [];
  const parentByCode = new Map(parentDetails.map((p) => [p.code, p]));

  const enriched = results.map((r: { icd10Code: string }) => {
    const rich = richByCode.get(r.icd10Code);
    const parent = rich?.parentCode ? parentByCode.get(rich.parentCode) : null;
    return {
      ...r,
      richDetail: rich
        ? {
            includes: rich.includes,
            excludes1: rich.excludes1,
            excludes2: rich.excludes2,
            codeFirst: rich.codeFirst,
            useAdditionalCode: rich.useAdditionalCode,
            codeAlso: rich.codeAlso,
            parentNotes: parent
              ? {
                  code: parent.code,
                  description: parent.description,
                  includes: parent.includes,
                  excludes1: parent.excludes1,
                  excludes2: parent.excludes2,
                  useAdditionalCode: parent.useAdditionalCode,
                }
              : null,
          }
        : null,
    };
  });

  return NextResponse.json({ results: enriched, total, page, pageSize, year });
}
