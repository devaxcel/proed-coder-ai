"use client";

import { useState, useEffect } from "react";
import { THEME } from "@/lib/theme";

const BRAND = THEME.primary;
const CARD = THEME.primaryLight;
const AMBER = "#B45309";
const AMBER_LIGHT = "#FEF3C7";

type Section = {
  id: string;
  sectionKey: string;
  title: string;
  content: string;
  status: "ACTIVE" | "PENDING_LICENSE";
  updatedBy: string | null;
  updatedAt: string;
};

export default function LegalPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "PENDING_LICENSE">("ACTIVE");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/legal");
      const json = await r.json();
      setSections(json.sections ?? []);
      setCanEdit(!!json.canEdit);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(s: Section) {
    setEditingId(s.id);
    setEditTitle(s.title);
    setEditContent(s.content);
    setEditStatus(s.status);
    setErr(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setErr(null);
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim() || !editContent.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch(`/api/legal/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent, status: editStatus }),
      });
      const json = await r.json();
      if (!r.ok) {
        setErr(json.error ?? "Save failed");
      } else {
        setEditingId(null);
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h1 className="text-xl font-bold text-white">Legal &amp; Disclaimers</h1>
          <p className="mt-1 text-sm text-white/85">
            The compliance notices that apply to ProEdCS Coder AI. This page stays available at all times — it is not a one-time notice to dismiss.
            {canEdit && " As Admin, you can edit any section below at any time."}
          </p>
        </div>
      </section>

      {/* Quick nav */}
      {!loading && sections.length > 0 && (
        <div className="rounded-lg border p-3 flex flex-wrap gap-3 text-xs" style={{ borderColor: BRAND, backgroundColor: CARD }}>
          {sections.map((s) => (
            <a key={s.id} href={`#${s.sectionKey}`} className="hover:underline" style={{ color: BRAND }}>
              {s.title}
            </a>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-4">
          {sections.map((s) => (
            <section key={s.id} id={s.sectionKey} className="scroll-mt-6 rounded-lg border p-5" style={{ borderColor: BRAND }}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="text-base font-bold" style={{ color: BRAND }}>{s.title}</h2>
                <div className="flex items-center gap-2 shrink-0">
                  {s.status === "PENDING_LICENSE" && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: AMBER_LIGHT, color: AMBER }}>
                      Pending AMA License
                    </span>
                  )}
                  {canEdit && editingId !== s.id && (
                    <button onClick={() => startEdit(s)} className="text-xs font-medium" style={{ color: BRAND }}>
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {editingId === s.id ? (
                <div className="space-y-2">
                  {err && <p className="text-xs text-red-600">{err}</p>}
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={10}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input type="radio" checked={editStatus === "ACTIVE"} onChange={() => setEditStatus("ACTIVE")} style={{ accentColor: BRAND }} />
                      Active now
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input type="radio" checked={editStatus === "PENDING_LICENSE"} onChange={() => setEditStatus("PENDING_LICENSE")} style={{ accentColor: BRAND }} />
                      Pending AMA License
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(s.id)}
                      disabled={saving || !editTitle.trim() || !editContent.trim()}
                      className="rounded-md px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: BRAND }}
                    >
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                    <button onClick={cancelEdit} className="rounded-md px-4 py-1.5 text-xs font-medium border" style={{ borderColor: BRAND, color: BRAND }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-700 whitespace-pre-wrap">{s.content}</div>
              )}

              {s.updatedBy && editingId !== s.id && (
                <p className="mt-2 text-[11px] text-slate-400">
                  Last edited by {s.updatedBy} · {new Date(s.updatedAt).toLocaleDateString()}
                </p>
              )}
            </section>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 italic">
        This page is a working compliance reference and does not constitute legal advice. ProEd&apos;s compliance and legal counsel should review this content periodically and before making it available outside of ProEd&apos;s own staff.
      </p>
    </div>
  );
}
