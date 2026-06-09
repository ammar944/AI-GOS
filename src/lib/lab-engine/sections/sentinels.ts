export const NOT_PROBED_THIS_RUN_PHRASE = "not probed this run";

export function isNotProbedSentinel(reason: unknown): boolean {
  return (
    typeof reason === "string" &&
    reason.toLowerCase().includes(NOT_PROBED_THIS_RUN_PHRASE)
  );
}
