import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#bae0fd",
          300: "#7cc8fb",
          400: "#36abf7",
          500: "#0c8ee9",
          600: "#0270c7",
          700: "#0359a1",
          800: "#074b84",
          900: "#0b3f6f",
          950: "#072849",
        },
        navy: {
          800: "#0d1b2a",
          900: "#08121e",
          950: "#04090f",
        },
        accent: {
          cyan: "#00d2d3",
          purple: "#6c5ce7",
          amber: "#f39c12",
          emerald: "#10b981",
          rose: "#f43f5e",
        }
      },
    },
  },
  plugins: [],
};
export default config;
