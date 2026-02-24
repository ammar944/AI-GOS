"use client";

/**
 * useFieldHighlight
 *
 * Consumed by section content leaf nodes to determine whether a given
 * field path is currently the target of a pending or just-approved edit.
 *
 * Returns a CSS class string + data attribute value to apply to the
 * wrapping element so the highlight styling in globals.css takes effect.
 *
 * Usage:
 *   const { highlightProps } = useFieldHighlight("painSolutionFit.primaryPain");
 *   <div {...highlightProps}>...</div>
 */

import { useContext } from "react";
import { BlueprintEditContext, type EditTargetState } from "./blueprint-edit-context";
import { cn } from "@/lib/utils";

// ── Field path matching ────────────────────────────────────────────────────────

/**
 * Returns true if the active field path targets this field.
 *
 * Rules:
 * - Exact match: "foo.bar" matches "foo.bar"
 * - Parent match: "foo" matches "foo.bar" (whole sub-object targeted)
 * - Array item: "items[2]" is treated as "items" prefix-match for list fields
 *   that don't render individual items separately
 */
function fieldIsTargeted(activeFieldPath: string, thisFieldPath: string): boolean {
  if (activeFieldPath === thisFieldPath) return true;
  // Active target is a sub-path of this field (e.g. active="foo.bar", this="foo")
  if (activeFieldPath.startsWith(thisFieldPath + ".")) return true;
  // Active target is an array index inside this field (e.g. active="items[0]", this="items")
  if (activeFieldPath.startsWith(thisFieldPath + "[")) return true;
  // This field is a sub-path of the active target (parent targeted, children highlight)
  if (thisFieldPath.startsWith(activeFieldPath + ".")) return true;
  if (thisFieldPath.startsWith(activeFieldPath + "[")) return true;
  return false;
}

// ── Return types ───────────────────────────────────────────────────────────────

export interface FieldHighlightResult {
  /** Spread onto the field wrapper element */
  highlightProps: {
    "data-field-path": string;
    "data-highlight-state"?: EditTargetState;
    className?: string;
  };
  /** Whether this field is currently targeted */
  isTargeted: boolean;
  /** Current state if targeted */
  state: EditTargetState | null;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useFieldHighlight(fieldPath: string): FieldHighlightResult {
  const ctx = useContext(BlueprintEditContext);

  // Context may be null if this component is rendered outside the provider
  // (e.g. in read-only blueprint pages without chat). Graceful degradation.
  // Also skip matching for empty field paths (DataCard/InsightCard with no fieldPath prop).
  if (!ctx || !ctx.activeEditTarget || !fieldPath) {
    return {
      highlightProps: { "data-field-path": fieldPath },
      isTargeted: false,
      state: null,
    };
  }

  const { activeEditTarget } = ctx;
  const isTargeted = fieldIsTargeted(activeEditTarget.fieldPath, fieldPath);

  if (!isTargeted) {
    return {
      highlightProps: { "data-field-path": fieldPath },
      isTargeted: false,
      state: null,
    };
  }

  const state = activeEditTarget.state;

  return {
    highlightProps: {
      "data-field-path": fieldPath,
      "data-highlight-state": state,
      className: cn(
        "blueprint-field-highlight",
        state === "pending" && "blueprint-field-pending",
        state === "approved" && "blueprint-field-approved",
        state === "rejected" && "blueprint-field-rejected"
      ),
    },
    isTargeted: true,
    state,
  };
}
