import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMfaEnforced } from "@/lib/mfa-config";
import { getMfaMethod } from "@/lib/mfa-method";
import MfaSetupClient from "./MfaSetupClient";

export const dynamic = "force-dynamic";

export default async function MfaSetupPage() {
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !uid) redirect("/login");
  if (!isMfaEnforced()) redirect("/");
  if ((await getMfaMethod()) === "EMAIL") redirect("/");

  const user = await db.user.findUnique({ where: { id: uid }, select: { mfaEnabled: true, email: true } });
  if (user?.mfaEnabled) redirect("/");

  return <MfaSetupClient email={user?.email ?? ""} />;
}
