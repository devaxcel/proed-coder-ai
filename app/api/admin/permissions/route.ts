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

const ALL_KEYS = [...CAPABILITIES.map((c) => c.key), ...EDIT_CAPABILITIES.map((c) => c.key)];

// Roles shown/edited in this matrix are every role EXCEPT the protected
// system role (Admin) — Admin always has full access and is never governed
// by this table (see lib/auth.ts's hardcoded ADMIN bypass), so it's
// excluded here the same way it always was when roles were a fixed enum.
async function getGovernedRoles() {
  return db.role.findMany({
    where: { isSystem: false },
    orderBy: { label: "asc" },
  });
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const roles = await getGovernedRoles();
  const roleKeys = roles.map((r) => r.key);

  const rows = await db.rolePermission.findMany();
  const matrix: Record<string, Record<string, boolean>> = {};
  for (const key of roleKeys) matrix[key] = {};

  for (const capKey of ALL_KEYS) {
    for (const roleKey of roleKeys) {
      const row = rows.find((r) => r.role === roleKey && r.capabilityKey === capKey);
      matrix[roleKey][capKey] = row?.allowed ?? false;
    }
  }

  return NextResponse.json({
    matrix,
    tabs: CAPABILITIES,
    editCapabilities: EDIT_CAPABILITIES,
    // Full {key, label} objects now (not bare strings) so the client can
    // render column headers for any role, including ones added later
    // from Admin > Roles, without needing a second fetch.
    roles: roles.map((r) => ({ key: r.key, label: r.label })),
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

  // Only ever write rows for roles that actually exist (and aren't the
  // protected system role) — ignores any stray/stale keys the client
  // might send, so a deleted role can never leave orphaned permission rows.
  const roles = await getGovernedRoles();
  const roleKeys = roles.map((r) => r.key);

  const ops = [];
  for (const roleKey of roleKeys) {
    const roleMatrix = matrix[roleKey] ?? {};
    for (const key of ALL_KEYS) {
      const allowed = !!roleMatrix[key];
      ops.push(
        db.rolePermission.upsert({
          where: { role_capabilityKey: { role: roleKey, capabilityKey: key } },
          update: { allowed },
          create: { role: roleKey, capabilityKey: key, allowed },
        })
      );
    }
  }

  await db.$transaction(ops);

  return NextResponse.json({ ok: true });
}
