import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#17365D",
        brand: "#2563EB",
        teal: { DEFAULT: "#0F766E", 700: "#115E59" },
        surface: "#F7F9FC",
        fitGreen: "#15803D",
        fitAmber: "#B45309",
        fitRed: "#B91C1C",
      },
      fontFamily: {
        display: ["Newsreader", "Georgia", "Cambria", "serif"],
        body: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(23,54,93,0.06), 0 4px 12px rgba(23,54,93,0.05)",
        lift: "0 2px 4px rgba(23,54,93,0.08), 0 10px 24px rgba(23,54,93,0.08)",
      },
      borderRadius: { card: "0.875rem" },
    },
  },
  plugins: [],
};
export default config;
