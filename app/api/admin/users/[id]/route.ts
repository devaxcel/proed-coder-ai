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
