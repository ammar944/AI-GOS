"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  /** When true, shows a text label next to the icon (sidebar expanded state) */
  expanded?: boolean;
}

export function ThemeToggle({ className, expanded }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className={cn(
          "flex items-center gap-3 h-10 px-4 rounded-lg",
          "transition-colors duration-150",
          className
        )}
        aria-label="Toggle theme"
      >
        <span className="h-[18px] w-[18px] shrink-0" />
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "flex items-center gap-3 h-10 px-4 rounded-lg cursor-pointer",
        "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
        "transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-[var(--accent-blue)] focus-visible:outline-offset-2",
        className
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun size={18} className="shrink-0" />
      ) : (
        <Moon size={18} className="shrink-0" />
      )}
      {expanded && (
        <span className="text-[13px] font-medium whitespace-nowrap">
          {isDark ? "Light mode" : "Dark mode"}
        </span>
      )}
    </button>
  );
}
