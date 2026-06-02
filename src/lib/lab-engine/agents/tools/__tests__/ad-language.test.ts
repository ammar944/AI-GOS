import { describe, expect, it } from "vitest";

import { detectAdLanguage } from "../ad-language";

describe("detectAdLanguage", () => {
  it("flags clear English ad copy as English", () => {
    const result = detectAdLanguage(
      "Close deals faster with the #1 sales platform. Start your free trial today.",
    );
    expect(result.isEnglish).toBe(true);
    expect(result.language).toBe("en");
    expect(result.confidence).toBe("high");
  });

  it("flags Spanish ad copy as non-English", () => {
    const result = detectAdLanguage(
      "Ahorra dinero con la mejor solución para tu negocio. Compra ahora y obtén un descuento gratis.",
    );
    expect(result.isEnglish).toBe(false);
    expect(result.language).toBe("es");
  });

  it("flags German ad copy as non-English", () => {
    const result = detectAdLanguage(
      "Steigern Sie Ihren Umsatz mit der besten Software für Ihr Unternehmen. Jetzt kostenlos testen.",
    );
    expect(result.isEnglish).toBe(false);
    expect(result.language).toBe("de");
  });

  it("flags Japanese (CJK) ad copy as non-English with high confidence", () => {
    const result = detectAdLanguage("最高のビジネスソリューションで売上を伸ばしましょう。今すぐ無料でお試しください。");
    expect(result.isEnglish).toBe(false);
    expect(result.confidence).toBe("high");
    expect(result.script).toBe("cjk");
  });

  it("flags Arabic ad copy as non-English", () => {
    const result = detectAdLanguage("نمِّ أعمالك مع أفضل منصة مبيعات. ابدأ تجربتك المجانية اليوم.");
    expect(result.isEnglish).toBe(false);
    expect(result.script).toBe("arabic");
  });

  it("flags Russian (Cyrillic) ad copy as non-English", () => {
    const result = detectAdLanguage("Увеличьте продажи с лучшей платформой. Начните бесплатный пробный период сегодня.");
    expect(result.isEnglish).toBe(false);
    expect(result.script).toBe("cyrillic");
  });

  it("does NOT quarantine empty or whitespace-only copy (cannot judge → assume English, low confidence)", () => {
    const result = detectAdLanguage("   ");
    expect(result.isEnglish).toBe(true);
    expect(result.confidence).toBe("low");
  });

  it("does NOT flag a short Latin brand token as non-English", () => {
    // Image-only ad whose only text is a brand word — must not be quarantined.
    const result = detectAdLanguage("Notion");
    expect(result.isEnglish).toBe(true);
    expect(result.confidence).toBe("low");
  });

  it("treats accented-but-English-context text conservatively (café résumé) as English", () => {
    // A couple of loanword diacritics must not trip the non-English gate on
    // otherwise-English copy.
    const result = detectAdLanguage(
      "Build your résumé and find your dream job with our hiring platform today.",
    );
    expect(result.isEnglish).toBe(true);
  });

  it("is resilient to mixed English + a foreign tagline (majority English stays English)", () => {
    const result = detectAdLanguage(
      "The best CRM for growing teams. Manage your pipeline, automate follow-ups, and close more deals every single month.",
    );
    expect(result.isEnglish).toBe(true);
  });

  it("flags a short German CTA via a single strong marker", () => {
    // 'Jetzt starten' hits exactly one strong marker — must still be non-English.
    const result = detectAdLanguage("Jetzt starten");
    expect(result.isEnglish).toBe(false);
    expect(result.language).toBe("de");
  });

  it("flags an unmodeled Latin language (Polish) via diacritic density", () => {
    const result = detectAdLanguage(
      "Załóż konto już dziś i oszczędzaj pieniądze za darmo w naszej aplikacji.",
    );
    expect(result.isEnglish).toBe(false);
  });

  it("does not flag an English CTA with no foreign markers", () => {
    const result = detectAdLanguage("Start your free trial today");
    expect(result.isEnglish).toBe(true);
  });
});
