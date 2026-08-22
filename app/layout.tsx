import "./globals.css";
import type { Metadata } from "next";
import { Quicksand } from "next/font/google";
import { auth, signOut } from "@/lib/auth";
import AppShell from "./components/AppShell";

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

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <html lang="en" className={quicksand.variable}>
      <body className="font-sans bg-white text-slate-900 antialiased">
        {session ? (
          <AppShell
            userName={session.user?.name ?? session.user?.email ?? "Account"}
            userRole={(session.user as { role?: string } | undefined)?.role}
            onSignOut={handleSignOut}
          >
            {children}
          </AppShell>
        ) : (
          <div className="min-h-screen flex flex-col">
            <main className="flex-1 w-full flex items-center justify-center px-4 py-12">
              {children}
            </main>
            <footer className="bg-navy text-white/80">
              <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 text-center text-xs opacity-70">
                ProEd Consulting &amp; Staffing · Built by AXCEL
              </div>
            </footer>
          </div>
        )}
      </body>
    </html>
  );
}
