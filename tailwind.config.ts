import type { Config } from "tailwindcss";

/**
 * ProEdCS visual identity — unified teal branding, matching ProEd's actual
 * internal tool documents (MEAT HCC Checklist, AWV/HEDIS Tool) rather than
 * the marketing-site blue. This keeps every page — outer chrome and content
 * pages alike — visually consistent under one palette.
 *
 * Primary teal (#0F6E77):   headers, nav accents, primary buttons
 * Dark teal (#0A555C):      top bar, footer, high-contrast strips
 * Light teal (#E6F4F5):     card backgrounds, subtle surfaces
 * Yellow (#EFC932):         CTA accent (kept — strong contrast against teal)
 */

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#e6f4f5",
          100: "#cce9eb",
          200: "#99d3d7",
          300: "#66bdc3",
          400: "#3aa7ae",
          500: "#0f6e77", // ProEdCS primary teal
          600: "#0c5960",
          700: "#0a555c", // ProEdCS dark teal
          800: "#083f45",
          900: "#052a2e",
        },
        navy: {
          DEFAULT: "#0a555c", // repurposed as dark teal for continuity of class names
          light: "#0f6e77",
          dark: "#052a2e",
        },
        accent: {
          yellow: "#efc932",
          yellowDark: "#c9a81f",
        },
        surface: {
          DEFAULT: "#ffffff",
          soft: "#e6f4f5",
          softer: "#f0f9fa",
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
