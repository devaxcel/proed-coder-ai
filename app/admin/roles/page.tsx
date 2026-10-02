import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import RolesClient from "./RolesClient";

export default async function AdminRolesPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") {
    redirect("/");
  }

  return <RolesClient />;
}
