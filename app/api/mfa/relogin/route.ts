import { signOut } from "@/lib/auth";

export const runtime = "nodejs";

/** Clears a session created before two-factor was enforced and sends the user to sign in again. */
export async function GET() {
  await signOut({ redirectTo: "/login?reason=mfa" });
}
