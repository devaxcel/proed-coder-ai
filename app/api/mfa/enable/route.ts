import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit, registerFailure } from "@/lib/login-security";
import { isMfaEnforced } from "@/lib/mfa-config";
import { getMfaMethod } from "@/lib/mfa-method";
import { decryptSecret, generateBackupCodes, hashBackupCode, verifyTotp } from "@/lib/mfa";

export const runtime = "nodejs";

/** Confirm enrollment with a code from the app, activate MFA, and return one-time backup codes. */
export async function POST(req: NextRequest) {
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !uid) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isMfaEnforced()) return NextResponse.json({ error: "Two-factor sign-in is not enabled on this server." }, { status: 400 });
  if ((await getMfaMethod()) === "EMAIL") return NextResponse.json({ error: "Authenticator setup is not needed — sign-in codes are sent by email." }, { status: 400 });

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const user = await db.user.findUnique({ where: { id: uid } });
  if (!user || !user.mfaSecretEnc) return NextResponse.json({ error: "Start setup first (refresh the page)." }, { status: 400 });
  if (user.mfaEnabled) return NextResponse.json({ error: "Already set up." }, { status: 409 });

  let step: number | null = null;
  try {
    step = verifyTotp(decryptSecret(user.mfaSecretEnc), String(code ?? ""), null);
  } catch {
    return NextResponse.json({ error: "Could not read your setup. Refresh the page and scan the new QR code." }, { status: 400 });
  }
  if (step == null) {
    await registerFailure(uid, "mfa_enroll_code");
    return NextResponse.json({ error: "That code didn't match. Check the 6-digit code in your app and try again." }, { status: 400 });
  }

  const codes = generateBackupCodes();
  await db.$transaction([
    db.mfaBackupCode.deleteMany({ where: { userId: uid } }),
    db.mfaBackupCode.createMany({ data: codes.map((c) => ({ userId: uid, codeHash: hashBackupCode(c) })) }),
    db.user.update({ where: { id: uid }, data: { mfaEnabled: true, mfaEnrolledAt: new Date(), mfaLastStep: step } }),
  ]);
  await audit("mfa_enrolled", uid, {});
  return NextResponse.json({ backupCodes: codes });
}
