// Single source of truth for "the user typed a non-answer to fast-track the
// brief" detection. Shared by corpus-to-research-input.ts (run-path: drops the
// token to null so it never poisons the competitor ad-library query or the
// media budget) and prefill-from-corpus.ts (display-path: keeps the brief-review
// form blank instead of prefilling the literal junk). Kept as a zero-dependency
// leaf module so the client-side prefill path does not pull in the lab-engine
// import graph. (run 73dfbc0d, 2026-06-09.)

const NON_ANSWER_VALUES = new Set<string>([
  "idk",
  "idc",
  "dunno",
  "dk",
  "i dont know",
  "i don't know",
  "dont know",
  "don't know",
  "no idea",
  "no clue",
  "not sure",
  "unsure",
  "unknown",
  "not applicable",
  "n/a",
  "na",
  "nil",
  "none",
  "null",
  "nan",
  "tbd",
  "tba",
  "to be determined",
  "?",
  "??",
  "-",
  "--",
  "...",
]);

export function isNonAnswer(trimmed: string): boolean {
  const normalized = trimmed
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.?!]+$/g, "")
    .trim();

  if (normalized.length === 0) {
    return true;
  }

  if (NON_ANSWER_VALUES.has(normalized)) {
    return true;
  }

  // Repeated non-answer tokens such as "idk idk" or "na na".
  const tokens = normalized.split(" ");
  return (
    tokens.length > 1 && tokens.every((token) => NON_ANSWER_VALUES.has(token))
  );
}
