import type { Config } from "tailwindcss";

export default {
  content: ["./src/client/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        ink: "#1a1a1a",
        paper: "#fafaf9",
        line: "#e5e2dc",
        muted: "#8a857f",
        moss: "#65715a",
        blue: "#315f7c",
        clay: "#b86b4b",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
