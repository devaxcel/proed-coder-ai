"use client";

import { useState, useEffect } from "react";
import { THEME } from "@/lib/theme";

const BRAND = THEME.primary;
const CARD = THEME.primaryLight;

type Doc = {
  id: string;
  title: string;
  content: string;
  visibility: "INTERNAL" | "CLIENT_VISIBLE";
  createdBy: string | null;
  updatedAt: string;
};

export default function CompliancePage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"INTERNAL" | "CLIENT_VISIBLE">("INTERNAL");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editVisibility, setEditVisibility] = useState<"INTERNAL" | "CLIENT_VISIBLE">("INTERNAL");
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/compliance");
      const json = await r.json();
      setDocs(json.docs ?? []);
      setCanEdit(!!json.canEdit);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, visibility }),
      });
      if (r.ok) {
        setTitle("");
        setContent("");
        setVisibility("INTERNAL");
        setShowAdd(false);
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this compliance document?")) return;
    const r = await fetch(`/api/compliance/${id}`, { method: "DELETE" });
    if (r.ok) load();
  }

  function startEdit(doc: Doc) {
    setEditingId(doc.id);
    setEditTitle(doc.title);
    setEditContent(doc.content);
    setEditVisibility(doc.visibility);
    setExpandedId(doc.id); // show the edit form where the content view would be
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim() || !editContent.trim()) return;
    setEditSaving(true);
    try {
      const r = await fetch(`/api/compliance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent, visibility: editVisibility }),
      });
      if (r.ok) {
        setEditingId(null);
        load();
      }
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h1 className="text-xl font-bold text-white">Compliance</h1>
          <p className="mt-1 text-sm text-white/85">
            {canEdit
              ? "Internal compliance documents. Content marked \"Client Visible\" is also shown to Client-role accounts; everything else stays internal to ProEd staff."
              : "Compliance documents ProEd has shared with your organization."}
          </p>
        </div>
      </section>

      {!canEdit && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          You have view-only access to this tab. Contact ProEd to request changes to any document shown here.
        </div>
      )}

      {canEdit && (
        <div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="rounded-md px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: BRAND }}
          >
            {showAdd ? "Cancel" : "+ Add Document"}
          </button>

          {showAdd && (
            <form onSubmit={onAdd} className="mt-3 rounded-lg border p-4 space-y-3" style={{ borderColor: BRAND }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                placeholder="Document content"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="radio"
                    checked={visibility === "INTERNAL"}
                    onChange={() => setVisibility("INTERNAL")}
                    style={{ accentColor: BRAND }}
                  />
                  Internal only (ProEd staff)
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="radio"
                    checked={visibility === "CLIENT_VISIBLE"}
                    onChange={() => setVisibility("CLIENT_VISIBLE")}
                    style={{ accentColor: BRAND }}
                  />
                  Client Visible
                </label>
              </div>
              <button
                type="submit"
                disabled={saving || !title.trim() || !content.trim()}
                className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: BRAND }}
              >
                {saving ? "Saving…" : "Save Document"}
              </button>
            </form>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-slate-500">No compliance documents yet.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="rounded-lg border p-4" style={{ borderColor: BRAND }}>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                  className="text-left font-semibold text-sm flex items-center gap-1.5"
                  style={{ color: BRAND }}
                >
                  <span className="text-xs">{expandedId === d.id ? "▼" : "▶"}</span>
                  {d.title}
                </button>
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: d.visibility === "CLIENT_VISIBLE" ? "#DCFCE7" : CARD,
                      color: d.visibility === "CLIENT_VISIBLE" ? "#166534" : BRAND,
                    }}
                  >
                    {d.visibility === "CLIENT_VISIBLE" ? "Client Visible" : "Internal"}
                  </span>
                  {canEdit && editingId !== d.id && (
                    <>
                      <button onClick={() => startEdit(d)} className="text-xs" style={{ color: BRAND }}>
                        Edit
                      </button>
                      <button onClick={() => onDelete(d.id)} className="text-xs text-red-500 hover:text-red-700">
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {expandedId === d.id && editingId !== d.id && (
                <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{d.content}</p>
              )}

              {editingId === d.id && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={6}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="radio"
                        checked={editVisibility === "INTERNAL"}
                        onChange={() => setEditVisibility("INTERNAL")}
                        style={{ accentColor: BRAND }}
                      />
                      Internal only
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="radio"
                        checked={editVisibility === "CLIENT_VISIBLE"}
                        onChange={() => setEditVisibility("CLIENT_VISIBLE")}
                        style={{ accentColor: BRAND }}
                      />
                      Client Visible
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(d.id)}
                      disabled={editSaving || !editTitle.trim() || !editContent.trim()}
                      className="rounded-md px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: BRAND }}
                    >
                      {editSaving ? "Saving…" : "Save Changes"}
                    </button>
                    <button onClick={cancelEdit} className="rounded-md px-4 py-1.5 text-xs font-medium border" style={{ borderColor: BRAND, color: BRAND }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <p className="mt-1 text-[11px] text-slate-400">
                {d.createdBy ? `Added by ${d.createdBy} · ` : ""}
                {new Date(d.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
