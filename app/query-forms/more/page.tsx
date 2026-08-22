import QueryFormsBH from "../QueryFormsBH";
import Link from "next/link";

export default function QueryFormsMorePage() {
  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/query-forms" className="hover:underline" style={{ color: "#14457B" }}>
          ← Back to Form A
        </Link>
      </div>
      <QueryFormsBH />
    </div>
  );
}
