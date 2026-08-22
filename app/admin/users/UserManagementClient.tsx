"use client";

import { useState } from "react";

const TEAL = "#14457B";
const TEAL_LIGHT = "#E7ECF4";
const TEAL_DARK = "#14457B";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "CODER" | "AUDITOR";
  isActive: boolean;
  createdAt: string;
};

export default function UserManagementClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"ADMIN" | "CODER" | "AUDITOR">("CODER");

  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");

  async function refresh() {
    const r = await fetch("/api/admin/users");
    if (r.ok) {
      const json = await r.json();
      setUsers(json.users);
    }
  }

  async function onAddUser(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, password: newPassword, name: newName || undefined, role: newRole }),
      });
      const json = await r.json();
      if (!r.ok) {
        setErr(json.error ?? "Failed to create user");
      } else {
        setNewEmail("");
        setNewName("");
        setNewPassword("");
        setNewRole("CODER");
        setShowAddForm(false);
        await refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(id: string, patch: Partial<{ role: string; isActive: boolean; newPassword: string }>) {
    setErr(null);
    const r = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await r.json();
    if (!r.ok) {
      setErr(json.error ?? "Update failed");
      return false;
    }
    await refresh();
    return true;
  }

  async function onResetPassword(id: string) {
    if (!resetPasswordValue || resetPasswordValue.length < 8) {
      setErr("New password must be at least 8 characters");
      return;
    }
    const ok = await updateUser(id, { newPassword: resetPasswordValue });
    if (ok) {
      setResetTargetId(null);
      setResetPasswordValue("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3" style={{ backgroundColor: TEAL }}>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white leading-snug">User Management</h1>
            <p className="mt-1 text-sm text-white/85">Create accounts, assign roles, deactivate access</p>
          </div>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-md px-4 py-2 text-sm font-semibold text-navy"
            style={{ backgroundColor: "#EFC932" }}
          >
            {showAddForm ? "Cancel" : "+ Add User"}
          </button>
        </div>
      </section>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      )}

      {showAddForm && (
        <form onSubmit={onAddUser} className="rounded-lg border p-5 space-y-3" style={{ borderColor: TEAL }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="mb-0.5 block text-xs font-medium" style={{ color: TEAL_DARK }}>Email</label>
              <input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-medium" style={{ color: TEAL_DARK }}>Full name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-medium" style={{ color: TEAL_DARK }}>Temporary password</label>
              <input required type="text" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-medium" style={{ color: TEAL_DARK }}>Role</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as "ADMIN" | "CODER" | "AUDITOR")} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="CODER">Coder</option>
                <option value="AUDITOR">Auditor</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: TEAL }}>
            {saving ? "Creating…" : "Create User"}
          </button>
        </form>
      )}

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: TEAL }}>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: TEAL_DARK }}>
            <tr>
              <th className="px-3 py-2 text-left text-white font-medium">Name</th>
              <th className="px-3 py-2 text-left text-white font-medium">Email</th>
              <th className="px-3 py-2 text-left text-white font-medium">Role</th>
              <th className="px-3 py-2 text-left text-white font-medium">Status</th>
              <th className="px-3 py-2 text-left text-white font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ backgroundColor: i % 2 === 0 ? TEAL_LIGHT : "white" }}>
                <td className="px-3 py-2">{u.name || "—"} {u.id === currentUserId && <span className="text-xs text-slate-400">(you)</span>}</td>
                <td className="px-3 py-2 text-slate-700">{u.email}</td>
                <td className="px-3 py-2">
                  <select
                    value={u.role}
                    onChange={(e) => updateUser(u.id, { role: e.target.value })}
                    className="rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                  >
                    <option value="CODER">Coder</option>
                    <option value="AUDITOR">Auditor</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => updateUser(u.id, { isActive: !u.isActive })}
                    className="rounded px-2 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: u.isActive ? "#DCFCE7" : "#FEE2E2",
                      color: u.isActive ? "#166534" : "#991B1B",
                    }}
                  >
                    {u.isActive ? "Active" : "Deactivated"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  {resetTargetId === u.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="New password"
                        value={resetPasswordValue}
                        onChange={(e) => setResetPasswordValue(e.target.value)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs w-32"
                      />
                      <button onClick={() => onResetPassword(u.id)} className="text-xs font-medium" style={{ color: TEAL }}>Save</button>
                      <button onClick={() => { setResetTargetId(null); setResetPasswordValue(""); }} className="text-xs text-slate-400">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setResetTargetId(u.id)} className="text-xs font-medium" style={{ color: TEAL }}>
                      Reset password
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Deactivated users keep their history but can no longer sign in. There must always be at least one active Admin account.
      </p>
    </div>
  );
}
