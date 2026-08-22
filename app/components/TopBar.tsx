"use client";

const BRAND = "#14457B";

export default function TopBar({
  onMenuClick,
  userName,
  userRole,
  onSignOut,
}: {
  onMenuClick: () => void;
  userName?: string;
  userRole?: string;
  onSignOut: () => Promise<void>;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Hamburger — mobile only, controls the sidebar drawer */}
          <button
            onClick={onMenuClick}
            className="lg:hidden rounded-md border border-slate-300 p-2 text-slate-700 shrink-0"
            aria-label="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Logo — always visible, links home. Hidden on mobile since Sidebar's
              drawer already shows it; shown from sm breakpoint up. */}
          <a href="/" className="hidden sm:block no-underline shrink-0">
            <img src="/proed-logo.png" alt="ProEd Consulting" className="h-8 w-auto" />
          </a>
        </div>

        {/* Right side — role badge + user name + Sign out, always visible */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {userRole && (
            <span
              className="hidden sm:inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white"
              style={{ backgroundColor: BRAND }}
            >
              {userRole}
            </span>
          )}
          {userName && (
            <span className="hidden md:inline text-xs text-slate-600 truncate max-w-[160px]">
              {userName}
            </span>
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
      </div>
    </header>
  );
}
