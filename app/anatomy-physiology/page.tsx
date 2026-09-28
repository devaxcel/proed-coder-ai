"use client";

import { THEME } from "@/lib/theme";

const BRAND = THEME.primary;

export default function AnatomyPhysiologyPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h1 className="text-xl font-bold text-white">Anatomy and Physiology</h1>
          <p className="mt-1 text-sm text-white/85">
            Reference materials for anatomy and physiology — content coming soon.
          </p>
        </div>
      </section>

      <div className="rounded-lg border p-8 text-center" style={{ borderColor: BRAND }}>
        <p className="text-sm text-slate-500">
          This section is a placeholder. Content will be added here.
        </p>
      </div>
    </div>
  );
}
