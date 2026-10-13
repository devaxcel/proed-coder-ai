import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Searches the licensed AMA CPT code sets (CptCode table, one row per code per
// year — loaded by `npm run seed:cpt`). Defaults to the newest year that has
// already started; ?year= selects a specific code-set year.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const yearParam = parseInt(req.nextUrl.searchParams.get("year") ?? "", 10);

  const yearRows = await db.cptCode.groupBy({ by: ["year"] });
  const years = yearRows.map((y) => y.year).sort((a, b) => b - a);
  if (years.length === 0) return NextResponse.json({ results: [], years: [], year: null });

  const thisYear = new Date().getUTCFullYear();
  const year = years.includes(yearParam) ? yearParam : years.find((y) => y <= thisYear) ?? years[0];
  if (!q) return NextResponse.json({ results: [], years, year });

  const digits = /^[0-9]{4}[0-9FTUM]$/i.test(q);
  const results = await db.cptCode.findMany({
    where: {
      year,
      ...(digits
        ? { code: q.toUpperCase() }
        : {
            OR: [
              { code: { startsWith: q.toUpperCase() } },
              { longDesc: { contains: q, mode: "insensitive" } },
              { shortDesc: { contains: q, mode: "insensitive" } },
              { consumerDesc: { contains: q, mode: "insensitive" } },
            ],
          }),
    },
    select: { code: true, category: true, longDesc: true, shortDesc: true, consumerDesc: true },
    orderBy: { code: "asc" },
    take: 50,
  });

  return NextResponse.json({ results, years, year });
}
