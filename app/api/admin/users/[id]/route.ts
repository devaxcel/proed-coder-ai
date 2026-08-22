import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") return null;
  return session;
}

const UpdateBody = z.object({
  role: z.enum(["ADMIN", "CODER", "AUDITOR"]).optional(),
  isActive: z.boolean().optional(),
  newPassword: z.string().min(8).optional(),
  name: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const { id } = await params;

  const parsed = UpdateBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { role, isActive, newPassword, name } = parsed.data;

  // Prevent an admin from locking themselves out entirely by deactivating
  // their own only-admin account. Simple safety check, not exhaustive.
  const currentUserId = (session.user as { id?: string } | undefined)?.id;
  if (id === currentUserId && (isActive === false || role !== undefined && role !== "ADMIN")) {
    const adminCount = await db.user.count({ where: { role: "ADMIN", isActive: true } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Cannot deactivate or demote the only remaining admin account" },
        { status: 400 }
      );
    }
  }

  const data: Record<string, unknown> = {};
  if (role !== undefined) data.role = role;
  if (isActive !== undefined) data.isActive = isActive;
  if (name !== undefined) data.name = name;
  if (newPassword) data.passwordHash = await hashPassword(newPassword);

  const user = await db.user.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });

  return NextResponse.json({ user });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const { id } = await params;

  const currentUserId = (session.user as { id?: string } | undefined)?.id;
  if (id === currentUserId) {
    return NextResponse.json({ error: "You cannot delete your own account while signed in" }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (target.role === "ADMIN" && target.isActive) {
    const activeAdminCount = await db.user.count({ where: { role: "ADMIN", isActive: true } });
    if (activeAdminCount <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the only remaining admin account" },
        { status: 400 }
      );
    }
  }

  // Detach (don't delete) their history first — saved query forms and audit
  // log entries stay in the system for record-keeping, just no longer
  // attributed to a live account. Then remove the account itself.
  await db.$transaction([
    db.queryForm.updateMany({ where: { userId: id }, data: { userId: null } }),
    db.auditLog.updateMany({ where: { userId: id }, data: { userId: null } }),
    db.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({ deleted: true });
}
