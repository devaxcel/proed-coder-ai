import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const codes: string[] = Array.isArray(body.codes) ? body.codes.filter(Boolean) : [];
  if (codes.length === 0) {
    return NextResponse.json({ results: {} });
  }

  const [pricing, updates] = await Promise.all([
    db.dmeposFeeSchedule.findMany({
      where: { code: { in: codes } },
      orderBy: { modifier1: "asc" }, // prefer the no-modifier row when multiple exist
    }),
    db.hcpcsCodeUpdate.findMany({
      where: { code: { in: codes } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const results: Record<string, {
    pricing: { caNonRural: number | null; caRural: number | null; description: string; category: string } | null;
    discontinued: { termDate: string | null; quarter: string } | null;
  }> = {};

  for (const code of codes) {
    const priceRow = pricing.find((p) => p.code === code && !p.modifier1) ?? pricing.find((p) => p.code === code);
    const updateRow = updates.find((u) => u.code === code && u.actionCode === "D");
    results[code] = {
      pricing: priceRow
        ? { caNonRural: priceRow.caNonRural, caRural: priceRow.caRural, description: priceRow.description, category: priceRow.category }
        : null,
      discontinued: updateRow ? { termDate: updateRow.termDate, quarter: updateRow.quarter } : null,
    };
  }

  return NextResponse.json({ results });
}
