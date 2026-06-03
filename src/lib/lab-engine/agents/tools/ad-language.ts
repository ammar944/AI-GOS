import { franc } from "franc-min";

/**
 * Language detection for competitor ad creative copy.
 *
 * The competitor ad engine must not surface non-English creatives in the
 * verified wall (the "weird non-English ads" symptom). There is no language
 * lib in the dependency tree and the lab engine runs in-process on Vercel, so
 * this is a deterministic heuristic — no model call, no install risk:
 *
 *  1. Non-Latin scripts (CJK, Cyrillic, Arabic, Hebrew, Thai, Devanagari,
 *     Greek, Hangul) are an UNAMBIGUOUS non-English signal — these catch the
 *     most jarring cases with certainty.
 *  2. Latin script: classify as non-English only when >= 2 distinct STRONG
 *     foreign function-word markers hit. The markers are curated to avoid
 *     English collisions (no "per"/"die"/"no"/"la"), and diacritics alone never
 *     trip the gate, so English copy containing a loanword ("résumé", "café")
 *     stays English.
 *
 * Sparse copy (image-only ads, bare brand tokens) is intentionally treated as
 * English with low confidence so a text-less creative is never quarantined as
 * "foreign".
 */

export type AdLanguageScript =
  | "latin"
  | "cjk"
  | "korean"
  | "cyrillic"
  | "arabic"
  | "hebrew"
  | "thai"
  | "devanagari"
  | "greek"
  | "unknown";

export interface AdLanguageResult {
  /** Coarse ISO-639-1-ish label ("en","es","de","fr","pt","it") or a script code for non-Latin, or "und". */
  language: string;
  isEnglish: boolean;
  script: AdLanguageScript;
  confidence: "high" | "low";
}

interface ScriptRange {
  readonly script: Exclude<AdLanguageScript, "latin" | "unknown">;
  readonly language: string;
  readonly pattern: RegExp;
}

// Order matters only for disjoint ranges; each is counted independently.
const NON_LATIN_SCRIPTS: readonly ScriptRange[] = [
  { script: "cjk", language: "cjk", pattern: /[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]/g },
  { script: "korean", language: "ko", pattern: /[가-힣ᄀ-ᇿ]/g },
  { script: "cyrillic", language: "ru", pattern: /[Ѐ-ӿ]/g },
  { script: "arabic", language: "ar", pattern: /[؀-ۿݐ-ݿ]/g },
  { script: "hebrew", language: "he", pattern: /[֐-׿]/g },
  { script: "thai", language: "th", pattern: /[฀-๿]/g },
  { script: "devanagari", language: "hi", pattern: /[ऀ-ॿ]/g },
  { script: "greek", language: "el", pattern: /[Ͱ-Ͽ]/g },
];

// Two-tier foreign markers. `strong` words essentially never appear in English
// ad copy, so a SINGLE hit is decisive (catches short CTAs like "Jetzt starten").
// `weak` words are common in their language but could appear incidentally, so they
// only count toward the >=2 total-hit threshold — this keeps English copy with a
// stray loanword ("résumé", "café") from being misflagged.
const LATIN_MARKERS: ReadonlyArray<{
  language: string;
  strong: ReadonlySet<string>;
  weak: ReadonlySet<string>;
}> = [
  {
    language: "es",
    strong: new Set([
      "gratis", "ahora", "descuento", "comprar", "compra", "ahorra", "negocio",
      "dinero", "oferta", "mejor", "envío", "envio", "obtén", "obten",
      "solución", "solucion", "gratuito", "empresa", "ventas",
    ]),
    weak: new Set(["más", "mas", "tu", "tus", "para", "con"]),
  },
  {
    language: "de",
    strong: new Set([
      "kostenlos", "kostenloser", "jetzt", "testen", "unternehmen", "umsatz",
      "steigern", "ihren", "besten", "für", "fur", "erfahren",
    ]),
    weak: new Set(["und", "mit", "sie", "ihr", "mehr", "oder"]),
  },
  {
    language: "fr",
    strong: new Set([
      "gratuit", "gratuitement", "achetez", "maintenant", "meilleur",
      "entreprise", "découvrez", "decouvrez", "votre", "essai",
    ]),
    weak: new Set(["vos", "avec", "pour", "vous", "des", "votre"]),
  },
  {
    language: "pt",
    strong: new Set([
      "grátis", "gratuito", "você", "voce", "agora", "compre", "negócio",
      "negocio", "melhor", "vendas", "empresa", "experimente",
    ]),
    weak: new Set(["não", "nao", "mais", "sua", "seu", "com"]),
  },
  {
    language: "it",
    strong: new Set([
      "gratis", "gratuito", "migliore", "azienda", "vendite", "acquista",
      "adesso", "scopri", "prova",
    ]),
    weak: new Set(["più", "piu", "ora", "tuo", "tua", "tuoi"]),
  },
];

const LATIN_LETTER = /[A-Za-zÀ-ɏ]/g;
// Latin letters carrying diacritics (Latin-1 Supplement + Extended-A/B + Additional).
// English almost never uses these, so a high density is a non-English signal even
// for languages we do not model with markers (Polish, Turkish, Vietnamese, …).
const DIACRITIC_LETTER = /[À-ɏḀ-ỿ]/g;

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches === null ? 0 : matches.length;
}

// franc returns ISO 639-3; map the common ad-market languages to a short label.
// Only the English/non-English distinction is load-bearing — unmapped codes fall
// back to the raw ISO 639-3 code, which is still != "en" so it quarantines.
const ISO3_LABEL: Record<string, string> = {
  spa: "es", deu: "de", fra: "fr", por: "pt", ita: "it", nld: "nl",
  pol: "pl", tur: "tr", hrv: "hr", srp: "sr", bos: "bs", slv: "sl",
  ces: "cs", slk: "sk", swe: "sv", nor: "no", dan: "da", fin: "fi",
  hun: "hu", ron: "ro", ell: "el", rus: "ru", ukr: "uk", vie: "vi",
  ind: "id", tgl: "tl", cat: "ca", eus: "eu", glg: "gl",
};

export function detectAdLanguage(rawText: string): AdLanguageResult {
  const text = (rawText ?? "").trim();
  const latinLetters = countMatches(text, LATIN_LETTER);

  // Tally non-Latin scripts first — any meaningful presence is decisive.
  let bestScript: ScriptRange | null = null;
  let bestScriptCount = 0;
  for (const range of NON_LATIN_SCRIPTS) {
    const count = countMatches(text, range.pattern);
    if (count > bestScriptCount) {
      bestScriptCount = count;
      bestScript = range;
    }
  }

  const totalLetters = latinLetters + bestScriptCount;

  if (totalLetters < 2) {
    return { language: "und", isEnglish: true, script: "unknown", confidence: "low" };
  }

  // A non-Latin script that is >=15% of letters (or >=2 chars when Latin is
  // absent) means the creative is not English.
  if (
    bestScript !== null &&
    (bestScriptCount / totalLetters >= 0.15 || (latinLetters === 0 && bestScriptCount >= 2))
  ) {
    return {
      language: bestScript.language,
      isEnglish: false,
      script: bestScript.script,
      confidence: "high",
    };
  }

  // Primary: a real statistical detector (franc) over the full copy. It needs ~10
  // characters to classify, so short CTAs fall through to the marker heuristic.
  // This is what catches the long tail the heuristic cannot model — Croatian,
  // Polish, Turkish, Dutch, etc. (the live E2E surfaced Croatian civic ads passing
  // as English).
  const iso3 = franc(text, { minLength: 10 });
  if (iso3 === "eng") {
    return {
      language: "en",
      isEnglish: true,
      script: "latin",
      confidence: latinLetters >= 12 ? "high" : "low",
    };
  }
  if (iso3 !== "und") {
    return {
      language: ISO3_LABEL[iso3] ?? iso3,
      isEnglish: false,
      script: "latin",
      confidence: "high",
    };
  }

  // franc undetermined (copy too short to classify statistically): fall back to the
  // two-tier marker heuristic. A single STRONG marker is decisive; weak markers only
  // count toward a >=2 total so an English loanword cannot trip it.
  const tokens = text.toLowerCase().match(/[a-zÀ-ɏ]+/g) ?? [];
  const tokenSet = new Set(tokens);
  let bestLang = "";
  let bestStrong = 0;
  let bestTotal = 0;
  for (const { language, strong, weak } of LATIN_MARKERS) {
    let strongHits = 0;
    for (const word of strong) {
      if (tokenSet.has(word)) {
        strongHits += 1;
      }
    }
    let total = strongHits;
    for (const word of weak) {
      if (tokenSet.has(word)) {
        total += 1;
      }
    }
    if (strongHits > bestStrong || (strongHits === bestStrong && total > bestTotal)) {
      bestStrong = strongHits;
      bestTotal = total;
      bestLang = language;
    }
  }

  if (bestStrong >= 1 || bestTotal >= 2) {
    return {
      language: bestLang,
      isEnglish: false,
      script: "latin",
      confidence: bestStrong >= 1 || bestTotal >= 3 ? "high" : "low",
    };
  }

  // Backstop for unmodeled Latin languages (Polish, Turkish, Vietnamese, …):
  // English almost never carries diacritics, so a meaningful density flags
  // non-English even when no markers matched.
  const diacritics = countMatches(text, DIACRITIC_LETTER);
  if (latinLetters >= 8 && diacritics / latinLetters >= 0.08) {
    return { language: "und", isEnglish: false, script: "latin", confidence: "low" };
  }

  // Default: English. Confidence scales with how much copy we actually saw.
  return {
    language: "en",
    isEnglish: true,
    script: "latin",
    confidence: latinLetters >= 12 ? "high" : "low",
  };
}
