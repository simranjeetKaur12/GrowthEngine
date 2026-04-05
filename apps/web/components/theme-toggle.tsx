"use client";

import { Moon, SunMedium } from "lucide-react";

import { useTheme } from "./theme-provider";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, mounted, toggleTheme } = useTheme();
  const label = mounted ? (theme === "dark" ? "Light mode" : "Dark mode") : "Toggle theme";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={compact ? "theme-toggle-button theme-toggle-button-compact" : "theme-toggle-button"}
      aria-label={label}
      title={label}
    >
      <span className="theme-toggle-icon">
        {mounted && theme === "light" ? <Moon size={16} /> : <SunMedium size={16} />}
      </span>
      {!compact ? <span>{label}</span> : null}
    </button>
  );
}
