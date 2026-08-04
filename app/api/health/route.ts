import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Confirm DB reachable
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "reachable",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        db: "unreachable",
        error: err instanceof Error ? err.message : "unknown",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
