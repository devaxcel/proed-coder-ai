import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
  const pageSize = 25;

  if (!q) {
    return NextResponse.json({ results: [], total: 0, page, pageSize });
  }

  const where = {
    OR: [
      { term: { contains: q, mode: "insensitive" as const } },
      { fullPath: { contains: q, mode: "insensitive" as const } },
      { code: { contains: q.replace(/\./g, ""), mode: "insensitive" as const } },
    ],
  };

  const [results, total] = await Promise.all([
    // Sort by the TERM actually shown on each result card, not by `letter`
    // (CDC's top-level A-Z section, same for every entry under one main
    // term) + `fullPath` (the full breadcrumb string). Sorting by those two
    // reflects CDC's internal document structure, not what a user sees on
    // screen — a free-text search pulls in matches from many different
    // main terms/branches, and ordering by the hierarchy fields made the
    // visible term column look shuffled even though the underlying sort
    // was "correct" by CDC's own structure. `term` is already indexed
    // (@@index([term]) in schema.prisma), so this adds no new index.
    db.icdAlphabeticIndexEntry.findMany({
      where,
      orderBy: [{ term: "asc" }, { fullPath: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.icdAlphabeticIndexEntry.count({ where }),
  ]);

  return NextResponse.json({ results, total, page, pageSize });
}
