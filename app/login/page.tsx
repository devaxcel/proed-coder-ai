import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
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

  return <LoginForm callbackUrl={params.callbackUrl || "/"} />;
}
