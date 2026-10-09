import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Searches the existing MedicalCode table, filtered to codeSystem = "HCPCS".
// Mirrors app/api/cpt-search/route.ts exactly — same table, same query
// shape, just a different codeSystem filter. No new schema/migration needed.
//
// This replaces the sidebar's old "HCPCS Code Search" link, which pointed
// at /hcpcs-updates (the CMS quarterly-changes tracker, a separate, much
// smaller dataset) instead of a real full-code-set search.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ results: [] });

  const results = await db.medicalCode.findMany({
    where: {
      codeSystem: "HCPCS",
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      code: true,
      description: true,
      isBillable: true,
      hccCategory: true,
      hedisMeasure: true,
      codingNotes: true,
    },
    orderBy: { code: "asc" },
    take: 50,
  });

  return NextResponse.json({ results });
}
