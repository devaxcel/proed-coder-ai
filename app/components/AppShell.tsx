"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppShell({
  userName,
  userRole,
  onSignOut,
  children,
}: {
  userName?: string;
  userRole?: string;
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar isOpen={mobileOpen} onClose={() => setMobileOpen(false)} userRole={userRole} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          onMenuClick={() => setMobileOpen(true)}
          userName={userName}
          userRole={userRole}
          onSignOut={onSignOut}
        />

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </main>

        <footer className="bg-navy text-white/80">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-semibold text-white">ProEd Consulting &amp; Staffing</span>
              <span className="mx-2 opacity-40">·</span>
              <span>West Covina, California</span>
            </div>
            <div className="opacity-70">Coder AI v1.0 · Built by AXCEL</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
