import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        respect: {
          being: "hsl(220 60% 45%)",
          change: "hsl(25 75% 48%)",
          rest: "hsl(160 45% 42%)",
          same: "hsl(280 50% 52%)",
          different: "hsl(0 55% 50%)",
        },
      },
    },
  },
  plugins: [],
};
export default config;
