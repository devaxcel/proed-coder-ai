"use client";

import { useState, useEffect } from "react";

const BRAND = "#14457B";
const CARD = "#E7ECF4";
const ROLES = ["CODER", "AUDITOR", "CLIENT"] as const;
const ROLE_LABELS: Record<string, string> = { CODER: "Coder", AUDITOR: "Auditor", CLIENT: "Client" };

type Tab = { key: string; label: string };
type Matrix = Record<string, Record<string, boolean>>;

export default function PermissionsClient() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [editCapabilities, setEditCapabilities] = useState<Tab[]>([]);
  const [matrix, setMatrix] = useState<Matrix>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    fetch("/api/admin/permissions")
      .then((r) => r.json())
      .then((json) => {
        setTabs(json.tabs ?? []);
        setEditCapabilities(json.editCapabilities ?? []);
        setMatrix(json.matrix ?? {});
        setLoading(false);
      });
  }, []);

  function toggle(role: string, key: string) {
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...prev[role], [key]: !prev[role]?.[key] },
    }));
    setSavedMsg(false);
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matrix }),
      });
      if (r.ok) setSavedMsg(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h1 className="text-xl font-bold text-white">Role Permissions</h1>
          <p className="mt-1 text-sm text-white/85">
            Control exactly which tabs Coder, Auditor, and Client accounts can reach. Admin always has full access and is not shown here.
          </p>
        </div>
      </section>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        Changes take effect the next time an affected user signs in — not instantly for someone already logged in.
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: BRAND }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: BRAND }}>
              <th className="px-4 py-2 text-left text-white font-medium">Tab</th>
              {ROLES.map((role) => (
                <th key={role} className="px-4 py-2 text-center text-white font-medium">{ROLE_LABELS[role]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabs.map((tab, i) => (
              <tr key={tab.key} style={{ backgroundColor: i % 2 === 0 ? "white" : CARD }}>
                <td className="px-4 py-2 text-slate-700">{tab.label}</td>
                {ROLES.map((role) => (
                  <td key={role} className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!matrix[role]?.[tab.key]}
                      onChange={() => toggle(role, tab.key)}
                      className="h-4 w-4"
                      style={{ accentColor: BRAND }}
                    />
                  </td>
                ))}
              </tr>
            ))}
            {editCapabilities.map((cap, i) => (
              <tr key={cap.key} style={{ backgroundColor: (tabs.length + i) % 2 === 0 ? "white" : CARD }} className="border-t-2" >
                <td className="px-4 py-2 text-slate-700 italic">{cap.label}</td>
                {ROLES.map((role) => (
                  <td key={role} className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!matrix[role]?.[cap.key]}
                      onChange={() => toggle(role, cap.key)}
                      className="h-4 w-4"
                      style={{ accentColor: BRAND }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: BRAND }}
        >
          {saving ? "Saving…" : "Save Permissions"}
        </button>
        {savedMsg && <span className="text-sm text-green-600">✓ Saved</span>}
      </div>
    </div>
  );
}
