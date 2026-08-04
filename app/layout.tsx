import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { auth, signOut } from "@/lib/auth";

export const metadata: Metadata = {
  title: "ProEdcs Coder AI",
  description: "AI-powered medical coding & policy assistant — by AXCEL",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-brand-600 text-white grid place-items-center text-sm font-bold">
                    P
                  </div>
                  <div className="font-semibold">ProEdcs Coder AI</div>
                </div>
                {session && (
                  <nav className="flex items-center gap-4 text-sm">
                    <Link href="/" className="text-slate-700 hover:text-brand-600">
                      Codes search
                    </Link>
                    <Link
                      href="/query-forms"
                      className="text-slate-700 hover:text-brand-600"
                    >
                      Query forms
                    </Link>
                    <Link
                      href="/query-forms/history"
                      className="text-slate-700 hover:text-brand-600"
                    >
                      History
                    </Link>
                  </nav>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xs text-slate-500">Built by AXCEL</div>
                {session && (
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/login" });
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Sign out
                    </button>
                  </form>
                )}
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
