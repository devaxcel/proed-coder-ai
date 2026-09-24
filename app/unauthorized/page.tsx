import Link from "next/link";
import { THEME } from "@/lib/theme";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-6">
      <div className="text-4xl mb-3">🔒</div>
      <h1 className="text-lg font-bold text-slate-800 mb-2">You don&apos;t have access to this section</h1>
      <p className="text-sm text-slate-500 max-w-sm mb-4">
        Your account&apos;s role doesn&apos;t currently include this tool. If you believe this is incorrect, contact your ProEd administrator.
      </p>
      <Link href="/" className="text-sm font-medium" style={{ color: THEME.primary }}>
        ← Back to Codes Search
      </Link>
    </div>
  );
}
