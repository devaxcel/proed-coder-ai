/**
 * Central definition of every configurable tab/capability in the app.
 *
 * Admin always has full access to everything, hardcoded, regardless of
 * what's in the RolePermission table — this is a deliberate safety
 * guardrail so an Admin can never accidentally lock themselves out.
 * Only CODER, AUDITOR, and CLIENT are governed by the configurable table.
 *
 * IMPORTANT: this list was built by enumerating every actual route folder
 * in app/ and app/api/ at the time of writing, to make sure nothing is
 * left unprotected. If new tools/tabs are added later, add them here too.
 */

export const CAPABILITIES = [
  { key: "codes-search", label: "Codes Search" },
  { key: "policies-qa", label: "Policies Q&A" },
  { key: "query-forms", label: "Query Forms — Form A" },
  { key: "forms-bh", label: "Query Forms B–H" },
  { key: "history", label: "Query History" },
  { key: "annual-wellness", label: "Annual Wellness" },
  { key: "meat-hcc", label: "MEAT HCC Checklist" },
  { key: "icd10-mappings", label: "ICD-10 Mappings" },
  { key: "code-check", label: "Code Documentation Check" },
  { key: "document-upload", label: "Document Upload" },
  { key: "policy-generator", label: "Policy Generator" },
  { key: "hedis-measures", label: "HEDIS Measures" },
  { key: "em-tool", label: "E/M Tool" },
  { key: "claim-validation", label: "Claim Validation" },
  { key: "compliance", label: "Compliance" },
  { key: "legal", label: "Legal & Disclaimers" },
  { key: "user-management", label: "User Management" },
] as const;

// A capability that isn't a whole tab, but a specific action within an
// always-visible tab (everyone can see Legal; editing it is gated).
export const EDIT_CAPABILITIES = [
  { key: "edit-legal", label: "Edit Legal & Disclaimers content" },
] as const;

export type CapabilityKey = (typeof CAPABILITIES)[number]["key"] | (typeof EDIT_CAPABILITIES)[number]["key"];

// Ordered most-specific-first — resolvePath checks these in order and
// returns the first match, so a more specific prefix must come before a
// more general one that would otherwise swallow it (e.g. /query-forms/more
// before /query-forms).
const PATH_CAPABILITY_MAP: { prefix: string; key: string }[] = [
  { prefix: "/api/admin/users", key: "user-management" },
  { prefix: "/admin/users", key: "user-management" },
  // NOTE: /admin/permissions and /api/admin/permissions are DELIBERATELY
  // NOT in this map. They must stay hardcoded Admin-only (checked inside
  // that route/page directly), never governed by the configurable table
  // itself — otherwise granting "user-management" to a role would let
  // that role open the permissions matrix and grant itself anything,
  // including admin-equivalent access. This is the one part of the
  // system that must never become self-referential.

  { prefix: "/api/query-form/generate-bh", key: "forms-bh" },
  { prefix: "/api/query-form/export-bh", key: "forms-bh" },
  { prefix: "/api/query-form/list", key: "history" },
  { prefix: "/api/query-form/generate", key: "query-forms" },
  { prefix: "/api/query-form/export", key: "query-forms" },
  { prefix: "/api/query-form/save", key: "query-forms" },
  { prefix: "/query-forms/more", key: "forms-bh" },
  { prefix: "/query-forms/history", key: "history" },
  { prefix: "/query-forms", key: "query-forms" },

  { prefix: "/api/search", key: "codes-search" },

  { prefix: "/api/policies", key: "policies-qa" },
  { prefix: "/policies", key: "policies-qa" },

  { prefix: "/annual-wellness", key: "annual-wellness" },

  { prefix: "/api/meat-hcc", key: "meat-hcc" },
  { prefix: "/meat-hcc", key: "meat-hcc" },

  { prefix: "/api/icd10-mappings", key: "icd10-mappings" },
  { prefix: "/icd10-mappings", key: "icd10-mappings" },

  { prefix: "/api/code-check", key: "code-check" },
  { prefix: "/code-check", key: "code-check" },

  { prefix: "/api/document-upload", key: "document-upload" },
  { prefix: "/document-upload", key: "document-upload" },

  { prefix: "/api/policy-doc", key: "policy-generator" },
  { prefix: "/policy-generator", key: "policy-generator" },

  { prefix: "/hedis-measures", key: "hedis-measures" },

  { prefix: "/em-tool", key: "em-tool" },

  { prefix: "/api/hcpcs-lookup", key: "claim-validation" },
  { prefix: "/api/claim-validation", key: "claim-validation" },
  { prefix: "/claim-validation", key: "claim-validation" },

  { prefix: "/api/compliance", key: "compliance" },
  { prefix: "/compliance", key: "compliance" },

  { prefix: "/api/legal", key: "legal" }, // PATCH additionally requires edit-legal, checked inside that route
  { prefix: "/legal", key: "legal" },
];

/**
 * Resolve which capability key (if any) governs a given request path.
 * Returns null for paths with no configured restriction (e.g. /login,
 * /api/auth/*, /api/health — these are already excluded upstream in
 * middleware's matcher and never reach this function; a null return here
 * for anything else means "no restriction defined for this path" and the
 * request passes through unblocked).
 */
export function resolveCapabilityKey(pathname: string): string | null {
  for (const { prefix, key } of PATH_CAPABILITY_MAP) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return key;
    }
  }
  // Root path "/" is Codes Search — checked last since "/" would otherwise
  // match as a prefix of literally everything.
  if (pathname === "/") return "codes-search";
  return null;
}

export const ALL_CAPABILITY_KEYS: string[] = CAPABILITIES.map((c) => c.key);
