import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CAPABILITIES, EDIT_CAPABILITIES } from "@/lib/permissions";

export const runtime = "nodejs";

// Deliberately hardcoded, not capability-based — this route controls the
// permission system itself, so it must never be governed by it. See the
// note in lib/permissions.ts for why.
async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") return null;
  return session;
}

const ROLES = ["CODER", "AUDITOR", "CLIENT"] as const;
const ALL_KEYS = [...CAPABILITIES.map((c) => c.key), ...EDIT_CAPABILITIES.map((c) => c.key)];

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const rows = await db.rolePermission.findMany();
  const matrix: Record<string, Record<string, boolean>> = {};
  for (const role of ROLES) matrix[role] = {};

  for (const key of ALL_KEYS) {
    for (const role of ROLES) {
      const row = rows.find((r) => r.role === role && r.capabilityKey === key);
      matrix[role][key] = row?.allowed ?? false;
    }
  }

  return NextResponse.json({
    matrix,
    tabs: CAPABILITIES,
    editCapabilities: EDIT_CAPABILITIES,
    roles: ROLES,
  });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const matrix = body.matrix as Record<string, Record<string, boolean>>;
  if (!matrix || typeof matrix !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const ops = [];
  for (const role of ROLES) {
    const roleMatrix = matrix[role] ?? {};
    for (const key of ALL_KEYS) {
      const allowed = !!roleMatrix[key];
      ops.push(
        db.rolePermission.upsert({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          where: { role_capabilityKey: { role: role as any, capabilityKey: key } },
          update: { allowed },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: { role: role as any, capabilityKey: key, allowed },
        })
      );
    }
  }

  await db.$transaction(ops);

  return NextResponse.json({ ok: true });
}
