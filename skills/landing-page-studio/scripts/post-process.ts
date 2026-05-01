// skills/landing-page-studio/scripts/post-process.ts
// Post-gen pass: CSP injection + OKLCH normalization + Lucide CDN removal.
// Deterministic — zero AI/model calls. Runs on all 3 direction HTML files after T5.
//
// Usage:
//   npx tsx scripts/post-process.ts --run <run-id>

import { parse as parseHtml } from "node-html-parser";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(SKILL_ROOT, "../../..");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANONICAL_CSP =
  "default-src 'self' data:; " +
  "script-src cdnjs.cloudflare.com 'unsafe-inline'; " +
  "style-src cdnjs.cloudflare.com 'unsafe-inline' 'self'; " +
  "img-src 'self' data: https:; " +
  "connect-src 'none'; " +
  "frame-ancestors 'self'";

const DIRECTION_IDS = ["A", "B", "C"] as const;

// Colors to skip (not actual color values)
const SKIP_COLOR_KEYWORDS = new Set([
  "currentcolor", "transparent", "inherit", "initial", "unset",
  "revert", "revert-layer",
]);

// ---------------------------------------------------------------------------
// Pass 1: CSP injection
// ---------------------------------------------------------------------------

function injectCSP(html: string): { html: string; injected: boolean } {
  const root = parseHtml(html);
  const head = root.querySelector("head");
  if (!head) return { html, injected: false };

  const existing = head.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (existing) return { html, injected: false };

  const cspTag = `<meta http-equiv="Content-Security-Policy" content="${CANONICAL_CSP}">`;
  head.insertAdjacentHTML("afterbegin", cspTag);
  return { html: root.toString(), injected: true };
}

// ---------------------------------------------------------------------------
// Pass 2: OKLCH normalization
// ---------------------------------------------------------------------------

// Matches hex, rgb(...), hsl(...), and named colors in CSS value positions
const COLOR_PATTERN =
  /(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)|\b(?:red|blue|green|black|white|gray|grey|navy|purple|orange|yellow|pink|brown|lime|teal|aqua|cyan|magenta|maroon|olive|silver|coral|salmon|crimson|indigo|violet|gold|tan|beige|ivory|lavender|khaki|plum|orchid)\b)/gi;

// Inline sRGB → OKLCH conversion (no external dep).
// Accurate enough for post-processing normalization; not a full ICC conversion.
function srgbToOklch(r: number, g: number, b: number): [number, number, number] {
  // sRGB linearize
  const lin = (v: number) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const lr = lin(r), lg = lin(g), lb = lin(b);
  // Linear sRGB → XYZ D65
  const x = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const y = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const z = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  // XYZ → OKLab cube-root
  const cbrt = (v: number) => Math.cbrt(v);
  const l_ = cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z);
  const m_ = cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z);
  const s_ = cbrt(0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z);
  const L  = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a  = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bv = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C  = Math.sqrt(a * a + bv * bv);
  const H  = (Math.atan2(bv, a) * 180) / Math.PI;
  return [L, C, H < 0 ? H + 360 : H];
}

function parseHexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16) / 255,
      parseInt(h[1] + h[1], 16) / 255,
      parseInt(h[2] + h[2], 16) / 255,
    ];
  }
  if (h.length === 6) {
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ];
  }
  return null;
}

function parseRgbFn(s: string): [number, number, number] | null {
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!m) return null;
  return [parseFloat(m[1]) / 255, parseFloat(m[2]) / 255, parseFloat(m[3]) / 255];
}

function colorToOklch(colorStr: string): string | null {
  const lower = colorStr.toLowerCase().trim();
  if (SKIP_COLOR_KEYWORDS.has(lower)) return null;

  let rgb: [number, number, number] | null = null;

  if (lower.startsWith("#")) {
    rgb = parseHexToRgb(lower);
  } else if (lower.startsWith("rgb")) {
    rgb = parseRgbFn(lower);
  } else {
    // Named color — log and skip (would need a full named-color table)
    return null;
  }

  if (!rgb) return null;

  try {
    const [L, C, H] = srgbToOklch(...rgb);
    return `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${H.toFixed(2)})`;
  } catch {
    return null;
  }
}

function normalizeStyleValue(styleValue: string): { value: string; count: number } {
  let count = 0;
  const normalized = styleValue.replace(COLOR_PATTERN, (match) => {
    // Skip if already inside oklch() — shouldn't happen in style attr but be safe
    const converted = colorToOklch(match);
    if (!converted) return match;
    count++;
    return converted;
  });
  return { value: normalized, count };
}

function normalizeColorsInHtml(html: string): { html: string; count: number } {
  let totalCount = 0;

  // Process inline style attributes
  let result = html.replace(/\bstyle="([^"]+)"/g, (fullMatch, styleValue) => {
    const { value, count } = normalizeStyleValue(styleValue);
    totalCount += count;
    return `style="${value}"`;
  });

  // Process <style> block content
  result = result.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, open, content, close) => {
    const { value, count } = normalizeStyleValue(content);
    totalCount += count;
    return `${open}${value}${close}`;
  });

  return { html: result, count: totalCount };
}

// ---------------------------------------------------------------------------
// Pass 3: Lucide CDN removal
// ---------------------------------------------------------------------------

function removeLucideCDN(html: string, filename: string): { html: string; count: number } {
  let count = 0;
  const cleaned = html.replace(
    /<script[^>]+src=["'][^"']*lucide[^"']*["'][^>]*(?:\/>|><\/script>)/gi,
    () => {
      count++;
      return "";
    }
  );
  if (count > 0) {
    console.warn(
      `  Warning: Removed ${count} Lucide CDN script tag(s) from ${filename}. ` +
      `Lucide icons should be inlined by the generator (T5).`
    );
  }
  return { html: cleaned, count };
}

// ---------------------------------------------------------------------------
// Process a single file
// ---------------------------------------------------------------------------

async function processFile(htmlPath: string): Promise<void> {
  const filename = path.basename(htmlPath);

  // Read file — skip gracefully if missing
  let html: string;
  try {
    html = await fs.readFile(htmlPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.log(`  Skipping ${filename} — file not found`);
      return;
    }
    throw err;
  }

  // Track data-section count before (sanity check)
  const dataSectionsBefore = (html.match(/data-section=/g) ?? []).length;

  // Pass 1: CSP
  const { html: html1, injected: cspInjected } = injectCSP(html);

  // Pass 2: OKLCH normalization
  const { html: html2, count: colorCount } = normalizeColorsInHtml(html1);

  // Pass 3: Lucide removal
  const { html: html3, count: lucideCount } = removeLucideCDN(html2, filename);

  // Verify data-section attributes survived
  const dataSectionsAfter = (html3.match(/data-section=/g) ?? []).length;
  if (dataSectionsAfter !== dataSectionsBefore) {
    console.error(
      `  ERROR: data-section count changed in ${filename}: ${dataSectionsBefore} → ${dataSectionsAfter}`
    );
    // Write original back to be safe
    await fs.writeFile(htmlPath, html, "utf-8");
    return;
  }

  // Write back
  await fs.writeFile(htmlPath, html3, "utf-8");

  console.log(
    `  Processed ${filename}: CSP injected=${cspInjected ? "yes" : "no (already present)"}, ` +
    `colors normalized=${colorCount}, lucide tags removed=${lucideCount}`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const runIdx = args.indexOf("--run");

  if (runIdx === -1 || runIdx + 1 >= args.length) {
    console.error("Error: --run <run-id> is required");
    process.exit(1);
  }

  const runId = args[runIdx + 1];
  const htmlDir = path.join(REPO_ROOT, "output", runId, "html");

  console.log(`Post-processing run: ${runId}`);

  for (const id of DIRECTION_IDS) {
    const htmlPath = path.join(htmlDir, `direction-${id}.html`);
    await processFile(htmlPath);
  }

  console.log("Post-processing complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
