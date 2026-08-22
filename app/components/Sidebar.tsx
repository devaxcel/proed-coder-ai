"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BRAND = "#14457B";

const NAV_LINKS = [
  { href: "/", label: "Codes Search" },
  { href: "/policies", label: "Policies Q&A" },
  { href: "/query-forms", label: "Query Forms" },
  { href: "/annual-wellness", label: "Annual Wellness" },
  { href: "/meat-hcc", label: "MEAT HCC" },
  { href: "/icd10-mappings", label: "ICD-10 Mappings" },
  { href: "/code-check", label: "Code Check" },
  { href: "/query-forms/history", label: "History" },
];

export default function Sidebar({
  isOpen,
  onClose,
  userRole,
}: {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
}) {
  const pathname = usePathname();
  const isAdmin = userRole === "ADMIN";

  const linkClass = (href: string) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return `flex items-center rounded-md px-3 py-2.5 text-sm transition ${
      active ? "bg-white/15 text-white font-medium" : "text-white/75 hover:bg-white/10 hover:text-white"
    }`;
  };

  const content = (
    <div className="flex h-full flex-col" style={{ backgroundColor: BRAND }}>
      <div className="px-3 py-4 border-b border-white/10">
        <Link href="/" className="block no-underline" onClick={onClose}>
          <div className="rounded-md bg-white p-2">
            {/* Plain img tag, not next/image — avoids Turbopack's dev-mode
                image optimizer issues with locally-added static assets. */}
            <img src="/proed-logo.png" alt="ProEd Consulting" className="w-full h-auto" />
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} onClick={onClose} className={linkClass(link.href)}>
            {link.label}
          </Link>
        ))}
        <Link href="/query-forms/more" onClick={onClose} className={linkClass("/query-forms/more")}>
          Forms B–H
        </Link>

        {isAdmin && (
          <div className="pt-3 mt-3 border-t border-white/10">
            <div className="px-3 pb-1 text-[10px] uppercase tracking-wider text-white/40">Admin</div>
            <Link href="/admin/users" onClick={onClose} className={linkClass("/admin/users")}>
              User Management
            </Link>
          </div>
        )}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop — fixed, always visible, narrower than before */}
      <aside className="hidden lg:block w-52 shrink-0 sticky top-0 h-screen">{content}</aside>

      {/* Mobile drawer */}
      {isOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/40 z-40" onClick={onClose} aria-hidden />
          <div className="lg:hidden fixed left-0 top-0 bottom-0 w-64 max-w-[85vw] z-50 shadow-2xl">
            <div className="flex justify-end p-2" style={{ backgroundColor: BRAND }}>
              <button onClick={onClose} className="text-white/80 p-1" aria-label="Close menu">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="h-[calc(100%-40px)]">{content}</div>
          </div>
        </>
      )}
    </>
  );
}
