"use client";

import { useEffect, useState } from "react";
import { THEME } from "@/lib/theme";

const BRAND = THEME.primary;
const CARD = THEME.primaryLight;

type Role = { id: string; key: string; label: string; isSystem: boolean };

export default function RolesClient() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/roles");
    const json = await res.json();
    setRoles(json.roles ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addRole() {
    if (!newLabel.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Could not create role");
    } else {
      setNewLabel("");
      await load();
    }
    setSaving(false);
  }

  async function saveLabel(id: string) {
    if (!editingLabel.trim()) return;
    await fetch(`/api/admin/roles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editingLabel.trim() }),
    });
    setEditingId(null);
    await load();
  }

  async function deleteRole(role: Role) {
    if (!confirm(`Delete the "${role.label}" role? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/roles/${role.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error ?? "Could not delete role");
    } else {
      await load();
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h1 className="text-xl font-bold text-white">Roles</h1>
          <p className="mt-1 text-sm text-white/85">
            Add, rename, or remove roles. New roles start with no tab access — set their permissions on the Role Permissions page.
          </p>
        </div>
      </section>

      <div className="rounded-lg border p-5" style={{ borderColor: BRAND }}>
        <div className="text-sm font-semibold mb-3" style={{ color: BRAND }}>Add a new role</div>
        <div className="flex gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Billing Specialist"
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            onClick={addRole}
            disabled={saving || !newLabel.trim()}
            className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: BRAND }}
          >
            {saving ? "Adding…" : "Add Role"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: BRAND }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: BRAND }} className="text-white text-left">
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2 w-40">Key</th>
              <th className="px-3 py-2 w-56">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-500">Loading…</td></tr>
            )}
            {!loading && roles.map((role) => (
              <tr key={role.id} className="border-t" style={{ borderColor: CARD }}>
                <td className="px-3 py-2">
                  {editingId === role.id ? (
                    <input
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium text-slate-800">{role.label}</span>
                  )}
                  {role.isSystem && (
                    <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: CARD, color: BRAND }}>
                      Protected
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{role.key}</td>
                <td className="px-3 py-2">
                  {editingId === role.id ? (
                    <div className="flex gap-2">
                      <button onClick={() => saveLabel(role.id)} className="text-xs font-medium" style={{ color: BRAND }}>Save</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-slate-500">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setEditingId(role.id); setEditingLabel(role.label); }}
                        className="text-xs font-medium"
                        style={{ color: BRAND }}
                      >
                        Rename
                      </button>
                      {!role.isSystem && (
                        <button onClick={() => deleteRole(role)} className="text-xs font-medium text-red-600">
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
