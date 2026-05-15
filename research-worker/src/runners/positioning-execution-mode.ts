export type PositioningExecutionMode = 'draft' | 'deep';

export const DEFAULT_INITIAL_POSITIONING_EXECUTION_MODE: PositioningExecutionMode =
  'draft';

export const DEFAULT_RERUN_POSITIONING_EXECUTION_MODE: PositioningExecutionMode =
  'deep';

export function isPositioningExecutionMode(
  value: unknown,
): value is PositioningExecutionMode {
  return value === 'draft' || value === 'deep';
}

export function normalizePositioningExecutionMode(
  value: unknown,
  fallback: PositioningExecutionMode,
): PositioningExecutionMode {
  return isPositioningExecutionMode(value) ? value : fallback;
}
