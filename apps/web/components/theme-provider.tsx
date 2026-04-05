"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeMode;
  mounted: boolean;
  toggleTheme: () => void;
  setTheme: (nextTheme: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function detectTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const saved = window.localStorage.getItem("growthengine-theme");
  if (saved === "light" || saved === "dark") {
    return saved;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const nextTheme = detectTheme();
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    setMounted(true);
  }, []);

  function applyTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("growthengine-theme", nextTheme);
    }
    document.documentElement.dataset.theme = nextTheme;
  }

  function toggleTheme() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  const value = useMemo(() => ({ theme, mounted, toggleTheme, setTheme: applyTheme }), [mounted, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return value;
}
