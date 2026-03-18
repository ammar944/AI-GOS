"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full",
          "bg-[var(--bg-surface)] border border-[var(--border-default)]",
          "transition-colors duration-150",
          className
        )}
        aria-label="Toggle theme"
      >
        <span className="h-4 w-4" />
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full cursor-pointer",
        "bg-[var(--bg-surface)] border border-[var(--border-default)]",
        "hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)]",
        "transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-[var(--accent-blue)] focus-visible:outline-offset-2",
        className
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-[var(--text-secondary)]" />
      ) : (
        <Moon className="h-4 w-4 text-[var(--text-secondary)]" />
      )}
    </button>
  );
}
