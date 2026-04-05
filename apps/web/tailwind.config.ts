import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f1f8ff",
          100: "#d9ecff",
          200: "#add8ff",
          300: "#78beff",
          400: "#3f98ff",
          500: "#1d75ff",
          600: "#145ae3",
          700: "#1348b8",
          800: "#163f90",
          900: "#173775"
        }
      },
      boxShadow: {
        luxe: "0 20px 45px rgba(11,18,32,0.38)",
        panel: "0 8px 24px rgba(6,10,20,0.35)"
      },
      borderRadius: {
        xl2: "1.25rem"
      },
      fontFamily: {
        sans: ["Space Grotesk", "Segoe UI", "sans-serif"]
      },
      keyframes: {
        floatIn: {
          "0%": { opacity: "0", transform: "translateY(10px) scale(0.99)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" }
        }
      },
      animation: {
        floatIn: "floatIn 320ms ease-out"
      }
    }
  },
  plugins: []
};

export default config;
