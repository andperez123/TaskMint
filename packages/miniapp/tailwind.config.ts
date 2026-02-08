import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef9ff",
          100: "#d8f1ff",
          200: "#bae7ff",
          300: "#8bd9ff",
          400: "#54c2ff",
          500: "#2ca3ff",
          600: "#1585f5",
          700: "#0e6de1",
          800: "#1258b6",
          900: "#154b8f",
          950: "#122f57",
        },
      },
    },
  },
  plugins: [],
};

export default config;
