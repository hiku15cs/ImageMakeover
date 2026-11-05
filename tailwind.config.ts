import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          background: "#111215",
          surface: "#1A1C22",
          border: "#2E323D",
          gold: "#D4AF37",
          champagne: "#F3E5AB",
          antique: "#C5A059",
          foreground: "#F9F9FB",
          muted: "#A0A5B5",
        },
      },
      fontFamily: {
        display: ["Georgia", "Times New Roman", "serif"],
        sans: ["Arial", "Helvetica", "sans-serif"],
      },
      boxShadow: {
        gold: "0 0 32px rgb(212 175 55 / 16%)",
      },
    },
  },
  plugins: [],
};

export default config;
