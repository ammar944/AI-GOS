// =============================================================================
// Text Formatting Utilities
// Pure functions with no React dependency.
// =============================================================================

export const DIVIDER_DOUBLE = "═".repeat(60);
export const DIVIDER_SINGLE = "─".repeat(60);

/**
 * Safely extracts a string value from unknown data
 */
export function safeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/**
 * Safely extracts an array of strings from unknown data
 */
export function safeArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null) {
        // Handle objects with common string fields
        const obj = item as Record<string, unknown>;
        return safeString(obj.name || obj.title || obj.value || obj.text || "");
      }
      return String(item);
    });
  }
  // Handle JSON string arrays (e.g. from chat edit tool)
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return safeArray(parsed);
      } catch { /* not valid JSON, fall through */ }
    }
    return [value];
  }
  return [];
}

/**
 * Format a boolean as Yes/No
 */
export function formatBool(value: unknown): string {
  return value ? "Yes" : "No";
}
