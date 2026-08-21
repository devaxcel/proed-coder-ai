"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Codes search" },
  { href: "/policies", label: "Policies" },
  { href: "/query-forms", label: "Query forms" },
  { href: "/annual-wellness", label: "AWV" },
  { href: "/meat-hcc", label: "MEAT HCC" },
  { href: "/icd10-mappings", label: "ICD-10 Maps" },
  { href: "/code-check", label: "Code Check" },
  { href: "/query-forms/history", label: "History" },
];

export default function SiteNav({
  onSignOut,
  userName,
  userRole,
}: {
  onSignOut: () => Promise<void>;
  userName?: string;
  userRole?: string;
}) {
  const [open, setOpen] = useState(false);

  // Close on Escape for keyboard users
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Desktop nav — single line, compact, never wraps. Breakpoint lowered
          to lg (1024px) since Windows display scaling (125%/150%, common on
          laptops) shrinks the effective CSS viewport below what the raw
          window width suggests — xl (1280px) was too optimistic. */}
      <nav className="hidden lg:flex items-center gap-0.5 text-[13px] flex-nowrap overflow-x-auto scrollbar-none min-w-0">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md px-2 py-1.5 text-slate-700 hover:bg-brand-50 hover:text-brand-600 transition whitespace-nowrap shrink-0"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="hidden lg:flex items-center gap-2 shrink-0">
        {userName && (
          <div className="text-right leading-tight">
            <div className="text-xs font-medium text-slate-700 truncate max-w-[140px]">{userName}</div>
            {userRole && <div className="text-[10px] uppercase tracking-wide text-slate-400">{userRole}</div>}
          </div>
        )}
        <form action={onSignOut}>
          <button
            type="submit"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition whitespace-nowrap"
          >
            Sign out
          </button>
        </form>
      </div>

      {/* Hamburger toggle — shown below lg */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="lg:hidden rounded-md border border-slate-300 bg-white p-2 text-slate-700 shrink-0"
        aria-label="Toggle menu"
        aria-expanded={open}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
        )}
      </button>

      {/* Backdrop — click outside to close */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 z-40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Polished dropdown panel */}
      {open && (
        <div className="lg:hidden absolute right-4 sm:right-6 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-lg border border-slate-200 shadow-xl z-50 overflow-hidden">
          {userName && (
            <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50">
              <div className="text-sm font-medium text-slate-800 truncate">{userName}</div>
              {userRole && <div className="text-[10px] uppercase tracking-wide text-slate-400">{userRole}</div>}
            </div>
          )}
          <nav className="flex flex-col p-2 max-h-[70vh] overflow-y-auto">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-600 transition"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-slate-100 p-2">
            <form action={onSignOut}>
              <button
                type="submit"
                className="w-full rounded-md px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition text-left"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
