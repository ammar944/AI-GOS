/**
 * Zero-dependency language detection for competitor ad creative copy.
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

// Strong, ad-copy-frequent foreign markers chosen to NOT collide with common
// English words. Each set member must be a poor fit for an English sentence.
const LATIN_MARKERS: ReadonlyArray<{ language: string; words: ReadonlySet<string> }> = [
  {
    language: "es",
    words: new Set([
      "gratis", "ahora", "descuento", "comprar", "compra", "ahorra", "negocio",
      "dinero", "oferta", "mejor", "envío", "envio", "obtén", "obten", "solución",
      "solucion", "más", "tu", "tus", "para",
    ]),
  },
  {
    language: "de",
    words: new Set([
      "und", "für", "fur", "kostenlos", "jetzt", "testen", "unternehmen",
      "umsatz", "steigern", "ihren", "ihr", "besten", "mit", "sie", "mehr",
    ]),
  },
  {
    language: "fr",
    words: new Set([
      "gratuit", "achetez", "maintenant", "votre", "vos", "meilleur",
      "entreprise", "avec", "pour", "vous", "des", "découvrez", "decouvrez",
    ]),
  },
  {
    language: "pt",
    words: new Set([
      "grátis", "gratis", "você", "voce", "agora", "compre", "negócio",
      "negocio", "melhor", "não", "nao", "mais", "sua", "seu", "vendas",
    ]),
  },
  {
    language: "it",
    words: new Set([
      "gratis", "migliore", "azienda", "vendite", "più", "piu", "ora", "tuo",
      "tua", "acquista", "adesso", "tuoi",
    ]),
  },
];

const LATIN_LETTER = /[A-Za-zÀ-ɏ]/g;

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches === null ? 0 : matches.length;
}

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

  // Latin-script path: count distinct strong foreign markers per language.
  const tokens = text.toLowerCase().match(/[a-zÀ-ɏ]+/g) ?? [];
  const tokenSet = new Set(tokens);
  let bestLang = "";
  let bestHits = 0;
  for (const { language, words } of LATIN_MARKERS) {
    let hits = 0;
    for (const word of words) {
      if (tokenSet.has(word)) {
        hits += 1;
      }
    }
    if (hits > bestHits) {
      bestHits = hits;
      bestLang = language;
    }
  }

  if (bestHits >= 2) {
    return {
      language: bestLang,
      isEnglish: false,
      script: "latin",
      confidence: bestHits >= 3 ? "high" : "low",
    };
  }

  // Default: English. Confidence scales with how much copy we actually saw.
  return {
    language: "en",
    isEnglish: true,
    script: "latin",
    confidence: latinLetters >= 12 ? "high" : "low",
  };
}
