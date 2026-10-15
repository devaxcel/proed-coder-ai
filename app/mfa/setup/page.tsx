import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMfaEnforced } from "@/lib/mfa-config";
import MfaSetupClient from "./MfaSetupClient";
import { THEME } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function MfaSetupPage() {
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !uid) redirect("/login");
  if (!isMfaEnforced()) redirect("/");

  const user = await db.user.findUnique({ where: { id: uid }, select: { mfaEnabled: true, email: true } });

  if (user?.mfaEnabled) {
    return (
      <div className="flex w-full justify-center">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl">
          <h1 className="text-xl font-bold" style={{ color: THEME.primary }}>My sign-in security</h1>
          <p className="mt-3 text-sm text-slate-700">
            ✓ Your <b>authenticator app</b> is set up and is your main sign-in check. If you can&apos;t use it, the login screen offers
            <b> “Email me a code”</b> as a backup (sent to {user.email}), or you can use one of your backup codes.
          </p>
          <p className="mt-3 text-sm text-slate-600">Lost your phone, or want to set up a new one? Ask an administrator to reset your 2FA, then scan a new QR code from this page.</p>
          <Link href="/" className="mt-5 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: THEME.primary }}>Back to the app</Link>
        </div>
      </div>
    );
  }

  return <MfaSetupClient email={user?.email ?? ""} />;
}
