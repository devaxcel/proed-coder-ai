import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import SecurityClient from "./SecurityClient";

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/login?callbackUrl=/admin/security");
  if (role !== "ADMIN") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <b>Access denied.</b> Sign-in security settings are restricted to Admin accounts.
      </div>
    );
  }
  return <SecurityClient />;
}
