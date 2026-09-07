import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import PermissionsClient from "./PermissionsClient";

export default async function AdminPermissionsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session) {
    redirect("/login?callbackUrl=/admin/permissions");
  }
  if (role !== "ADMIN") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <b>Access denied.</b> Permissions management is restricted to Admin accounts.
      </div>
    );
  }

  return <PermissionsClient />;
}
