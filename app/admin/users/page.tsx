import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import UserManagementClient from "./UserManagementClient";

export default async function AdminUsersPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session) {
    redirect("/login?callbackUrl=/admin/users");
  }
  if (role !== "ADMIN") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <b>Access denied.</b> User management is restricted to Admin accounts.
      </div>
    );
  }

  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const currentUserId = (session.user as { id?: string } | undefined)?.id ?? "";

  return <UserManagementClient initialUsers={users} currentUserId={currentUserId} />;
}
