import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// PATCH /api/admin/roles/[id] — rename a role's display label only.
// `key` and `isSystem` are intentionally not editable here: changing a
// key would orphan every User/RolePermission row already using the old
// one, and isSystem is a protection flag, not a user-facing setting.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = !!session && sessionRole === "ADMIN";
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const label = String(body.label ?? "").trim();
  if (!label) {
    return NextResponse.json({ error: "Role name (label) is required" }, { status: 400 });
  }

  const role = await db.role.update({ where: { id }, data: { label } });
  return NextResponse.json({ role });
}

// DELETE /api/admin/roles/[id] — blocked for the system (Admin) role, and
// blocked while any User still holds this role, so deleting a role can
// never silently strand a real account in a non-existent role.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = !!session && sessionRole === "ADMIN";
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const role = await db.role.findUnique({ where: { id } });
  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }
  if (role.isSystem) {
    return NextResponse.json({ error: "The Admin role is protected and cannot be deleted" }, { status: 400 });
  }

  const usersWithRole = await db.user.count({ where: { role: role.key } });
  if (usersWithRole > 0) {
    return NextResponse.json(
      { error: `${usersWithRole} user(s) still have this role — reassign them before deleting it` },
      { status: 409 }
    );
  }

  await db.$transaction([
    db.rolePermission.deleteMany({ where: { role: role.key } }),
    db.role.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
