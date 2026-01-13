// Syntax highlighting utility for blueprint content
// Based on AI-GOS Design System v1.0 specifications

import type { CSSProperties } from "react";

/**
 * Line style configuration for syntax highlighting
 */
export interface LineStyle {
  color: string;
  fontWeight?: number;
  fontSize?: number;
}

/**
 * Determines the appropriate styling for a given line of blueprint content
 *
 * Rules (in order of precedence):
 * 1. Section headers (ALL CAPS) -> primary text, bold, 14px
 * 2. Dividers (═ or ─) -> muted text
 * 3. Bullet points (• or □) -> secondary text
 * 4. Numbered items (^\d+\.) -> accent blue for number
 * 5. Values with % or $ -> success color
 * 6. Default -> tertiary text
 *
 * @param line - The line of text to analyze
 * @returns CSS properties for styling the line
 */
export function highlightLine(line: string): CSSProperties {
  const trimmed = line.trim();

  // Empty line - return default
  if (!trimmed) {
    return { color: "var(--text-tertiary, #888888)" };
  }

  // Section headers (ALL CAPS - at least 3 chars, all uppercase letters and spaces)
  if (/^[A-Z][A-Z\s:&\-\d]+$/.test(trimmed) && trimmed.length >= 3) {
    return {
      color: "var(--text-primary, #ffffff)",
      fontWeight: 700,
      fontSize: 14,
    };
  }

  // Dividers (lines starting with box drawing characters)
  if (trimmed.startsWith("═") || trimmed.startsWith("─") || /^[═─]+$/.test(trimmed)) {
    return { color: "var(--text-muted, #333333)" };
  }

  // Bullet points
  if (trimmed.startsWith("•") || trimmed.startsWith("□") || trimmed.startsWith("■")) {
    return { color: "var(--text-secondary, #a0a0a0)" };
  }

  // Numbered items (e.g., "1.", "2.", "10.")
  if (/^\d+\./.test(trimmed)) {
    return { color: "var(--accent-blue, #3b82f6)" };
  }

  // Values with percentages or currency
  if (/%/.test(trimmed) || /\$[\d,]+/.test(trimmed)) {
    return { color: "var(--success, #22c55e)" };
  }

  // Key-value pairs (label: value format) - highlight the label
  if (/^[A-Za-z\s]+:\s*.+$/.test(trimmed)) {
    return { color: "var(--text-secondary, #a0a0a0)" };
  }

  // Default styling
  return { color: "var(--text-tertiary, #888888)" };
}

/**
 * Type guard for checking if a line is a section header
 */
export function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  return /^[A-Z][A-Z\s:&\-\d]+$/.test(trimmed) && trimmed.length >= 3;
}

/**
 * Type guard for checking if a line is a divider
 */
export function isDivider(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("═") || trimmed.startsWith("─") || /^[═─]+$/.test(trimmed);
}
