"use client";

import { useState, useEffect } from "react";
import { THEME } from "@/lib/theme";

const BRAND = THEME.primary;
const CARD = THEME.primaryLight;

type Tab = { key: string; label: string };
type Role = { key: string; label: string };
type Matrix = Record<string, Record<string, boolean>>;

export default function PermissionsClient() {
  const [roles, setRoles] = useState<Role[]>([]);
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
        setRoles(json.roles ?? []);
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
            Control exactly which tabs each role can reach. New roles created in Admin &gt; Roles appear here
            automatically. Admin always has full access and is not shown here.
          </p>
        </div>
      </section>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        Changes take effect the next time an affected user signs in — not instantly for someone already logged in.
      </div>

      {roles.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No non-Admin roles exist yet. Add one in Admin &gt; Roles first.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: BRAND }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: BRAND }}>
                <th className="px-4 py-2 text-left text-white font-medium">Tab</th>
                {roles.map((role) => (
                  <th key={role.key} className="px-4 py-2 text-center text-white font-medium">{role.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabs.map((tab, i) => (
                <tr key={tab.key} style={{ backgroundColor: i % 2 === 0 ? "white" : CARD }}>
                  <td className="px-4 py-2 text-slate-700">{tab.label}</td>
                  {roles.map((role) => (
                    <td key={role.key} className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!matrix[role.key]?.[tab.key]}
                        onChange={() => toggle(role.key, tab.key)}
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
                  {roles.map((role) => (
                    <td key={role.key} className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!matrix[role.key]?.[cap.key]}
                        onChange={() => toggle(role.key, cap.key)}
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
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || roles.length === 0}
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
