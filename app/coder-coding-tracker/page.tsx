import { THEME } from "@/lib/theme";

export const metadata = { title: "Coder Coding Tracker" };

export default function CoderCodingTrackerPage() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg p-4" style={{ background: THEME.primary }}>
        <h1 className="text-xl font-bold text-white">Coder Coding Tracker</h1>
        <p className="text-sm text-gray-200">
          Build claim coding notes, track coded cases, and produce the weekly provider report.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <span>
          <b>Your cases live in this browser tab until you save them.</b> Use <b>Save</b> in the Tracker to download the Excel file, and open it again later to continue. Nothing is stored on our servers.
        </span>
        <a href="/coder-coding-tracker/frame" target="_blank" rel="noopener" className="font-semibold underline">
          Open full screen ↗
        </a>
      </div>

      <iframe
        src="/coder-coding-tracker/frame"
        title="Coder Coding Tracker"
        className="w-full rounded-lg border bg-white"
        style={{ height: "calc(100vh - 220px)", minHeight: 760 }}
      />
    </div>
  );
}
