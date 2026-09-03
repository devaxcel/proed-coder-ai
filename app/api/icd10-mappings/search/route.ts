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

  return NextResponse.json({ results, total, page, pageSize, year });
}
