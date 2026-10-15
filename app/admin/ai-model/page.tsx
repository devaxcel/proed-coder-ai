import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AiModelClient from "./AiModelClient";

export const dynamic = "force-dynamic";

export default async function AdminAiModelPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/login?callbackUrl=/admin/ai-model");
  if (role !== "ADMIN") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <b>Access denied.</b> AI model settings are restricted to Admin accounts.
      </div>
    );
  }
  return <AiModelClient />;
}
