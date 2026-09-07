import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const allowed = (session.user as { allowedCapabilities?: string[] } | undefined)?.allowedCapabilities ?? [];
  return NextResponse.json({ allowedCapabilities: allowed });
}
