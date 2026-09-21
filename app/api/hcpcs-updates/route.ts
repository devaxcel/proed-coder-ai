import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const ACTION_LABELS: Record<string, string> = {
  A: "Added",
  D: "Discontinued",
  N: "No change",
  R: "Reactivated",
  B: "Revised",
  C: "Revised",
  F: "Revised",
  P: "Payment change",
  S: "Revised",
  T: "Revised",
};

export async function GET(req: NextRequest) {
  const actionCode = req.nextUrl.searchParams.get("action") ?? "";
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
  const pageSize = 25;

  const where: Record<string, unknown> = {};
  if (actionCode) where.actionCode = actionCode;
  if (q) {
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { longDesc: { contains: q, mode: "insensitive" } },
    ];
  }

  const [results, total, quarters] = await Promise.all([
    db.hcpcsCodeUpdate.findMany({
      where,
      orderBy: { code: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.hcpcsCodeUpdate.count({ where }),
    db.hcpcsCodeUpdate.findMany({ distinct: ["quarter"], select: { quarter: true } }),
  ]);

  return NextResponse.json({
    results,
    total,
    page,
    pageSize,
    quarters: quarters.map((q) => q.quarter),
    actionLabels: ACTION_LABELS,
  });
}
