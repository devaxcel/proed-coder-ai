"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";

const BRAND = "#14457B";

type NavLink = { href: string; label: string; key: string };
type NavGroup = { label: string; links: NavLink[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Code Lookup & Reference",
    links: [
      { href: "/", label: "Codes Search", key: "codes-search" },
      { href: "/icd10-mappings", label: "ICD-10 Mappings", key: "icd10-mappings" },
      { href: "/icd10-index", label: "ICD-10-CM Index", key: "icd10-index" },
      { href: "/icd9-lookup", label: "ICD-9-CM Legacy", key: "icd9-lookup" },
      { href: "/hcpcs-updates", label: "HCPCS Updates", key: "hcpcs-updates" },
      { href: "/covid-vaccine", label: "COVID Vaccine Codes", key: "covid-vaccine" },
      { href: "/hedis-measures", label: "HEDIS Measures", key: "hedis-measures" },
    ],
  },
  {
    label: "Documentation & Validation Tools",
    links: [
      { href: "/code-check", label: "Code Check", key: "code-check" },
      { href: "/document-upload", label: "Document Upload", key: "document-upload" },
      { href: "/claim-validation", label: "Claim Validation", key: "claim-validation" },
      { href: "/em-tool", label: "E/M Tool", key: "em-tool" },
      { href: "/meat-hcc", label: "MEAT HCC", key: "meat-hcc" },
      { href: "/annual-wellness", label: "Annual Wellness", key: "annual-wellness" },
    ],
  },
  {
    label: "Query Forms",
    links: [
      { href: "/query-forms", label: "Query Forms", key: "query-forms" },
      { href: "/query-forms/more", label: "Forms B–H", key: "forms-bh" },
      { href: "/query-forms/history", label: "History", key: "history" },
    ],
  },
  {
    label: "Policies & Compliance",
    links: [
      { href: "/policies", label: "Policies Q&A", key: "policies-qa" },
      { href: "/policy-generator", label: "Policy Generator", key: "policy-generator" },
      { href: "/compliance", label: "Compliance", key: "compliance" },
      { href: "/legal", label: "Legal & Disclaimers", key: "legal" },
    ],
  },
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
  // Admin always sees everything — no need to fetch. Everyone else's
  // sidebar reflects whatever Admin has configured in Role Permissions.
  const [allowed, setAllowed] = useState<string[] | null>(isAdmin ? null : []);

  useEffect(() => {
    if (isAdmin) return; // Admin bypasses entirely, nothing to fetch
    fetch("/api/my-permissions")
      .then((r) => r.json())
      .then((json) => setAllowed(json.allowedCapabilities ?? []))
      .catch(() => setAllowed([]));
  }, [isAdmin]);

  const canSee = (key: string) => isAdmin || (allowed?.includes(key) ?? false);

  // Which group contains the currently active page — used to auto-open
  // that group by default, so landing on a page never hides its own nav.
  const activeGroupLabel = useMemo(() => {
    for (const group of NAV_GROUPS) {
      const match = group.links.find((l) => (l.href === "/" ? pathname === "/" : pathname.startsWith(l.href)));
      if (match) return group.label;
    }
    return null;
  }, [pathname]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (activeGroupLabel) {
      setOpenGroups((prev) => new Set(prev).add(activeGroupLabel));
    }
  }, [activeGroupLabel]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

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

      <nav className="flex-1 overflow-y-auto scrollbar-none px-3 py-4 space-y-1">
        {NAV_GROUPS.map((group) => {
          const visibleLinks = group.links.filter((l) => canSee(l.key));
          if (visibleLinks.length === 0) return null; // hide empty groups entirely
          const isOpen = openGroups.has(group.label);
          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/50 hover:text-white/80 transition"
              >
                <span>{group.label}</span>
                <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
              </button>
              {isOpen && (
                <div className="space-y-0.5 pb-1">
                  {visibleLinks.map((link) => (
                    <Link key={link.href} href={link.href} onClick={onClose} className={linkClass(link.href)}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isAdmin && (
          <div className="pt-3 mt-3 border-t border-white/10">
            <div className="px-3 pb-1 text-[10px] uppercase tracking-wider text-white/40">Admin</div>
            <Link href="/admin/users" onClick={onClose} className={linkClass("/admin/users")}>
              User Management
            </Link>
            <Link href="/admin/permissions" onClick={onClose} className={linkClass("/admin/permissions")}>
              Role Permissions
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
