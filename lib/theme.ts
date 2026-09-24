/**
 * ProEdCS Coder AI — centralized theme
 *
 * Colors extracted directly from the new "PROED Consulting — Compliance
 * & Privacy" logo (sampled from the actual logo file, not guessed):
 *   - Navy body text ("PRO", "CONSULTING", tagline)  -> primary
 *   - Gold body text ("ED")                          -> secondary
 *   - Soft tan-gold divider line under the wordmark   -> tertiary
 *
 * This is the single source of truth for brand color across the app.
 * As of this migration, every page and DOCX/PDF export route references
 * THEME (or THEME_HEX for libraries needing hex without the leading #)
 * instead of a locally hardcoded hex value.
 */

export const THEME = {
  // Primary — deep navy. Main brand color: sidebar background, headers,
  // primary buttons, primary text accents.
  primary: "#0B1E45",
  primaryDark: "#071630",
  primaryLight: "#EBEDF0", // properly derived light tint of the new navy — NOT the old teal's light tint

  // Secondary — gold. Used for accents, active-state highlights, and
  // anywhere a brand highlight (not a plain action) is called for.
  secondary: "#D4AF37",
  secondaryDark: "#B8912A",
  secondaryLight: "#F7F0DC",

  // Tertiary — soft tan-gold. Subtle dividers, quiet borders, understated
  // accents that shouldn't compete with primary or secondary.
  tertiary: "#D4C298",
  tertiaryLight: "#F2EDE0",

  // Semantic colors — unrelated to brand identity, kept separate on
  // purpose. These signal state (warning, pending-license, error), not
  // brand, so they should NOT be swapped out during a rebrand.
  amber: "#B45309",
  amberLight: "#FEF3C7",
  red: "#DC2626",
  redLight: "#FEF2F2",
  green: "#059669",
  greenLight: "#ECFDF5",
} as const;

// No-# variants — for libraries (like `docx`) that expect raw hex without
// the leading hash. Derived from THEME above, not duplicated by hand, so
// they can never drift out of sync with it.
export const THEME_HEX = {
  primary: THEME.primary.replace("#", ""),
  primaryLight: THEME.primaryLight.replace("#", ""),
  secondary: THEME.secondary.replace("#", ""),
  tertiary: THEME.tertiary.replace("#", ""),
} as const;

export type ThemeKey = keyof typeof THEME;

/**
 * Converts a "#RRGGBB" hex color into pdf-lib's expected [0-1, 0-1, 0-1]
 * float format. Used by any route that draws directly with pdf-lib's
 * rgb() function instead of CSS, so those colors stay derived from THEME
 * rather than hardcoded as separate float literals that could drift out
 * of sync with the rest of the app.
 */
export function hexToRgbFloat(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}
