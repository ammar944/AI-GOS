"use client";

import { BlueprintViewer } from "./blueprint-viewer";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";

interface StrategicBlueprintDisplayProps {
  strategicBlueprint: StrategicBlueprintOutput;
  isStreaming?: boolean;
}

/**
 * StrategicBlueprintDisplay - Main display component for strategic blueprints
 *
 * This component uses the v2.0 DocumentEditor aesthetic via BlueprintViewer,
 * featuring traffic lights, line numbers, and syntax highlighting.
 *
 * Maintains backward compatibility with existing props interface.
 */
export function StrategicBlueprintDisplay({
  strategicBlueprint,
  isStreaming = false,
}: StrategicBlueprintDisplayProps) {
  return (
    <BlueprintViewer
      strategicBlueprint={strategicBlueprint}
      isStreaming={isStreaming}
    />
  );
}
