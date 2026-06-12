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

// A value that is ONLY an unfilled template token — "$[Budget]",
// "[Budget] / Month", "{budget}", "$[X]" — is template-literal garbage, not an
// answer. A live paid-media run shipped the literal "$[Budget] / Month" because
// this leaked through the brief into the budget math. Anchored to the whole
// string so real answers that merely contain brackets ("Starter $49/mo
// [annual billing]") never match. (B3, 2026-06-10.)
const TEMPLATE_TOKEN_PATTERN =
  /^\$?\s*[[{][^\]}]*[\]}]\s*(?:\/\s*mo(?:nth)?(?:ly)?)?$/i;

// Sentence-level hedge phrases the corpus model emits INSTEAD of null when a
// field is not publicly discoverable ("Primarily global / not explicitly
// limited in public sources"). Token-level isNonAnswer cannot catch these.
// Used by the prefill display path so the brief form stays blank instead of
// asking the user to read and delete a meta-statement about source coverage.
const HEDGE_PHRASE_PATTERN =
  /not (explicitly|publicly|clearly) (limited|disclosed|stated)|public sources do not|no (public|cited) (evidence|sources)|undisclosed/i;

export function isHedgeAnswer(trimmed: string): boolean {
  return HEDGE_PHRASE_PATTERN.test(trimmed);
}

export function isNonAnswer(trimmed: string): boolean {
  const normalized = trimmed
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.?!]+$/g, "")
    .trim();

  if (normalized.length === 0) {
    return true;
  }

  if (TEMPLATE_TOKEN_PATTERN.test(normalized)) {
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
