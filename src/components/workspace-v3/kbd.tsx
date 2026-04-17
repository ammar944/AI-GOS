"use client";

import { useState } from "react";

/**
 * Platform-aware keyboard chip.
 * - macOS: renders `⌘K` (command glyph + key)
 * - Windows/Linux: renders `Ctrl+K`
 *
 * Usage: <Kbd keyChar="K" /> or <Kbd keyChar=";" />
 * The handler side should accept both modifiers: e.metaKey || e.ctrlKey.
 *
 * Server-side renders as `⌘` (macOS default). Hydration mismatch is suppressed
 * on the container because the swap happens after `window` is available.
 */
export function Kbd({ keyChar }: { keyChar: string }) {
  const [isMac] = useState(() => {
    if (typeof window === "undefined") return true;
    return /Mac|iPhone|iPad|iPod/.test(window.navigator.platform);
  });

  return (
    <span className="v3-kbd" suppressHydrationWarning>
      <span className="v3-kbd-mod">{isMac ? "⌘" : "Ctrl+"}</span>
      {keyChar}
    </span>
  );
}
