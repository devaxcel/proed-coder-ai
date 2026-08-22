import type { Config } from "tailwindcss";

/**
 * ProEdCS visual identity — confirmed brand color from proedcs.com:
 * background #14457B, white text, Quicksand for headings.
 */

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#e7ecf4",
          100: "#cfd9e9",
          200: "#9fb3d3",
          300: "#6f8dbd",
          400: "#3f67a7",
          500: "#14457b", // ProEdCS confirmed brand color
          600: "#113a68",
          700: "#0e2f55",
          800: "#0a2442",
          900: "#07192f",
        },
        navy: {
          DEFAULT: "#14457b",
          light: "#3f67a7",
          dark: "#0a2442",
        },
        accent: {
          yellow: "#efc932",
          yellowDark: "#c9a81f",
        },
        surface: {
          DEFAULT: "#ffffff",
          soft: "#e7ecf4",
          softer: "#f2f5fa",
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
