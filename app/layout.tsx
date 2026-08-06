import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { Quicksand } from "next/font/google";
import { auth, signOut } from "@/lib/auth";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ProEdCS Coder AI",
  description:
    "AI-powered medical coding & policy assistant — for ProEd Consulting & Staffing · Built by AXCEL",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" className={quicksand.variable}>
      <body className="font-sans bg-white text-slate-900 antialiased">
        <div className="min-h-screen flex flex-col">
          {/* Top contact bar — matches ProEdCS site navy strip */}
          <div className="bg-navy text-white text-xs">
            <div className="mx-auto max-w-6xl px-6 py-2 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  +1-626-771-3704
                </span>
                <span className="hidden sm:flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  info@proedcs.com
                </span>
              </div>
              <div className="hidden md:block text-white/70">
                West Covina, California · Built by AXCEL
              </div>
            </div>
          </div>

          {/* Main header */}
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-3 no-underline">
                  <div className="h-10 w-10 rounded-md bg-brand-500 text-white grid place-items-center text-sm font-bold shadow-card">
                    PCS
                  </div>
                  <div>
                    <div className="font-brand font-semibold text-navy leading-tight">
                      ProEdCS Coder AI
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">
                      Medical coding · Auditing · Compliance
                    </div>
                  </div>
                </Link>
                {session && (
                  <nav className="flex items-center gap-1 text-sm">
                    <NavLink href="/">Codes search</NavLink>
                    <NavLink href="/policies">Policies</NavLink>
                    <NavLink href="/query-forms">Query forms</NavLink>
                    <NavLink href="/query-forms/history">History</NavLink>
                  </nav>
                )}
              </div>
              <div className="flex items-center gap-3">
                {session && (
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/login" });
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      Sign out
                    </button>
                  </form>
                )}
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-6 py-8 flex-1 w-full">{children}</main>

          {/* Footer strip — matches ProEdCS navy footer */}
          <footer className="bg-navy text-white/80 mt-16">
            <div className="mx-auto max-w-6xl px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-semibold text-white">
                  ProEd Consulting &amp; Staffing
                </span>
                <span className="mx-2 opacity-40">·</span>
                <span>West Covina, California</span>
              </div>
              <div className="opacity-70">
                Coder AI v1.0 · Built by AXCEL · Aligned with ACDIS/AHIMA 2026 &amp; CMS standards
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-brand-50 hover:text-brand-600 transition"
    >
      {children}
    </Link>
  );
}
