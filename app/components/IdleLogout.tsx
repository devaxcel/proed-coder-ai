"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WARN_SECONDS = 120;
const KEY = "medrecpros-last-activity";
const EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;

/**
 * Automatic logoff after inactivity (HIPAA §164.312(a)(2)(iii)).
 * Activity counts in this tab, in other tabs of the app, and INSIDE embedded
 * same-origin pages (the Coder Coding Tracker iframe) — otherwise typing in the
 * tracker would look like inactivity. A warning with a countdown appears first.
 */
export default function IdleLogout({ minutes, onSignOut }: { minutes: number; onSignOut: () => Promise<void> }) {
  const [warnLeft, setWarnLeft] = useState<number | null>(null);
  const last = useRef(Date.now());
  const signOutRef = useRef(onSignOut);
  signOutRef.current = onSignOut;

  const touch = useCallback(() => {
    last.current = Date.now();
    try { localStorage.setItem(KEY, String(last.current)); } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    let lastWrite = 0;
    const attached = new WeakSet<Document>();
    const onAct = () => {
      const now = Date.now();
      if (now - lastWrite < 5000) return; // throttle
      lastWrite = now;
      touch();
    };
    const attach = (doc: Document) => {
      if (attached.has(doc)) return;
      attached.add(doc);
      EVENTS.forEach((e) => doc.addEventListener(e, onAct, { passive: true, capture: true }));
    };
    attach(document);
    const scanFrames = () => {
      document.querySelectorAll("iframe").forEach((f) => {
        try { if (f.contentDocument) attach(f.contentDocument); } catch { /* cross-origin */ }
      });
    };
    scanFrames();
    const scan = setInterval(scanFrames, 3000);

    const tick = setInterval(() => {
      let latest = last.current;
      try { latest = Math.max(latest, parseInt(localStorage.getItem(KEY) ?? "0", 10) || 0); } catch { /* ignore */ }
      const idleMs = Date.now() - latest;
      const limit = minutes * 60000;
      if (idleMs >= limit) {
        void signOutRef.current();
      } else if (idleMs >= limit - WARN_SECONDS * 1000) {
        setWarnLeft(Math.ceil((limit - idleMs) / 1000));
      } else {
        setWarnLeft(null);
      }
    }, 1000);

    touch();
    return () => {
      clearInterval(scan);
      clearInterval(tick);
      EVENTS.forEach((e) => document.removeEventListener(e, onAct, { capture: true }));
    };
  }, [minutes, touch]);

  if (warnLeft == null) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-2xl">
        <h2 className="text-lg font-bold text-slate-900">Still there?</h2>
        <p className="mt-2 text-sm text-slate-600">
          For patient privacy you&apos;ll be signed out in <b>{warnLeft}s</b> due to inactivity. Any unsaved work (including unsaved Tracker cases) will be lost.
        </p>
        <button type="button" onClick={() => { touch(); setWarnLeft(null); }} className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Stay signed in
        </button>
      </div>
    </div>
  );
}
