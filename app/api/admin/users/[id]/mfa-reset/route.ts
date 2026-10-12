import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/login-security";

export const runtime = "nodejs";

/**
 * Admin-only: remove a user's authenticator (lost phone) and clear any lockout.
 * Deliberately limited to the ADMIN role — NOT to the configurable "user-management"
 * capability — because resetting MFA weakens an account's protection.
 * The user enrolls a new authenticator at their next sign-in.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const adminId = (session?.user as { id?: string } | undefined)?.id ?? null;
  if (!session || role !== "ADMIN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await params;
  const target = await db.user.findUnique({ where: { id }, select: { id: true, email: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await db.$transaction([
    db.mfaBackupCode.deleteMany({ where: { userId: id } }),
    db.user.update({
      where: { id },
      data: { mfaEnabled: false, mfaSecretEnc: null, mfaEnrolledAt: null, mfaLastStep: null, failedLoginCount: 0, lockedUntil: null },
    }),
  ]);
  await audit("mfa_reset", adminId, { target: target.email, targetId: id });
  return NextResponse.json({ ok: true });
}
