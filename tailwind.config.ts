import type { Config } from "tailwindcss";

/**
 * ProEdCS visual identity — sampled from proedcs.com homepage:
 *
 *   Primary blue (#3B7DD8):  hero backgrounds, main CTAs, brand accents
 *   Dark navy (#0A2F5C):     top bar, footer strip, high-contrast headers
 *   Yellow (#EFC932):        client-buyer accent CTAs (reserved use)
 *   Light gray (#F5F7FB):    testimonial cards, subtle surfaces
 *
 * Font: Poppins (loaded via next/font/google in app/layout.tsx).
 */

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef4fc",
          100: "#dae7f8",
          200: "#b5cff1",
          300: "#8fb6e9",
          400: "#5e97df",
          500: "#3b7dd8", // ProEdCS primary
          600: "#2e62b0",
          700: "#245088",
          800: "#1b3d68",
          900: "#0a2f5c", // ProEdCS dark navy
        },
        navy: {
          DEFAULT: "#0a2f5c",
          light: "#1b3d68",
          dark: "#031a36",
        },
        accent: {
          yellow: "#efc932", // ProEdCS accent
          yellowDark: "#c9a81f",
        },
        surface: {
          DEFAULT: "#ffffff",
          soft: "#f5f7fb",
          softer: "#eef2f9",
        },
      },
      fontFamily: {
        // Poppins is loaded via next/font/google, exposed as --font-poppins CSS var
        sans: [
          "var(--font-poppins)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        brand: [
          "var(--font-poppins)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
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
