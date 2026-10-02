import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/admin/roles — list all roles, Admin-only (same as the existing
// Role Permissions matrix).
export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = !!session && role === "ADMIN";
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const roles = await db.role.findMany({ orderBy: [{ isSystem: "desc" }, { label: "asc" }] });
  return NextResponse.json({ roles });
}

// POST /api/admin/roles — create a new role. Body: { key, label }.
// `key` is the stable identifier stored on User.role / RolePermission.role
// (uppercase, letters/numbers/underscores only, e.g. "BILLING_SPECIALIST").
// New roles are never isSystem — only the seeded ADMIN role is protected.
export async function POST(req: NextRequest) {
  const session = await auth();
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = !!session && sessionRole === "ADMIN";
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const label = String(body.label ?? "").trim();
  let key = String(body.key ?? "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");

  if (!label) {
    return NextResponse.json({ error: "Role name (label) is required" }, { status: 400 });
  }
  if (!key) {
    // Derive a key from the label if the caller didn't send one (e.g. a
    // simple "Add role" form that only asks for a display name).
    key = label.toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  }
  if (!key) {
    return NextResponse.json({ error: "Could not derive a valid role key from that name" }, { status: 400 });
  }

  const existing = await db.role.findUnique({ where: { key } });
  if (existing) {
    return NextResponse.json({ error: `A role with key "${key}" already exists` }, { status: 409 });
  }

  const role = await db.role.create({
    data: { key, label, isSystem: false },
  });

  return NextResponse.json({ role }, { status: 201 });
}
