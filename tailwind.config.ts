import type { Config } from "tailwindcss";

/**
 * ProEdCS visual identity — updated to the new PROED Consulting
 * "Compliance & Privacy" logo: deep navy #0B1E45 + gold #D4AF37.
 * Colors here are kept in sync by hand with lib/theme.ts (THEME.primary /
 * THEME.secondary) — Tailwind config can't import a TS runtime value
 * directly, so if the brand colors change again, update both files.
 */

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f2f4",
          100: "#dfe2e7",
          200: "#b1b7c3",
          300: "#838ca0",
          400: "#485674",
          500: "#0b1e45", // ProEd primary — matches THEME.primary
          600: "#0a1a3c",
          700: "#081632",
          800: "#071229",
          900: "#050d1f",
        },
        navy: {
          DEFAULT: "#0b1e45",
          light: "#485674",
          dark: "#071229",
        },
        accent: {
          yellow: "#d4af37",     // ProEd secondary (gold) — matches THEME.secondary
          yellowDark: "#b8912a",
        },
        surface: {
          DEFAULT: "#ffffff",
          soft: "#ebedf0",       // matches THEME.primaryLight
          softer: "#f4f5f7",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-quicksand)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        brand: ["var(--font-quicksand)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.375rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
