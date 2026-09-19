import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#16201a",
        muted: "#65746a",
        line: "#d9e2dc",
        panel: "#f7faf8",
        accent: "#0f766e",
        warning: "#b45309",
        danger: "#b91c1c"
      },
      boxShadow: {
        soft: "0 10px 28px rgba(24, 44, 34, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
