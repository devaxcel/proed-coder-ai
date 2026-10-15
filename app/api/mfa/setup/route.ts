import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMfaEnforced } from "@/lib/mfa-config";
import { encryptSecret, generateSecret, groupKey, otpauthUri } from "@/lib/mfa";

export const runtime = "nodejs";

/** Start (or restart) enrollment: new secret, stored encrypted but NOT active until confirmed. */
export async function POST() {
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !uid) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isMfaEnforced()) return NextResponse.json({ error: "Two-factor sign-in is not enabled on this server." }, { status: 400 });

  const user = await db.user.findUnique({ where: { id: uid } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.mfaEnabled) return NextResponse.json({ error: "Authenticator already set up. Ask an admin to reset it." }, { status: 409 });

  const secret = generateSecret();
  await db.user.update({ where: { id: uid }, data: { mfaSecretEnc: encryptSecret(secret) } });

  const uri = otpauthUri(secret, user.email);
  const qr = await QRCode.toDataURL(uri, { width: 220, margin: 1 });
  return NextResponse.json({ qr, manualKey: groupKey(secret) });
}
