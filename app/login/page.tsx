import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; mfa?: string; reason?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  // Fixes: authenticated users landing back on /login (bookmark, browser
  // back button, stale tab) previously saw the login form again even
  // though they already had a valid session. Redirect them straight
  // through instead.
  if (session) {
    redirect(params.callbackUrl || "/");
  }

  const notice =
    params.mfa === "enabled"
      ? "Authenticator set up. Sign in again — you'll be asked for your 6-digit code."
      : params.reason === "mfa"
        ? "For security, please sign in again. Two-factor sign-in is now required."
        : params.reason === "idle"
          ? "You were signed out after a period of inactivity."
          : undefined;

  return <LoginForm callbackUrl={params.callbackUrl || "/"} notice={notice} />;
}
