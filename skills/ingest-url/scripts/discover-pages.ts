import * as fs from "fs";
import { fileURLToPath } from "url";

export type PageType =
  | "homepage"
  | "pricing"
  | "product"
  | "customers"
  | "case_study"
  | "about"
  | "demo"
  | "other";

export interface RawPageCandidate {
  url: string;
  title?: string;
  excerpt?: string;
}

export interface SelectedPage {
  url: string;
  page_type: PageType;
  title?: string;
  excerpt?: string;
}

interface DiscoveryInputObject {
  input_url?: string;
  base_url?: string;
  urls?: string[];
  pages?: RawPageCandidate[];
}

const skipPatterns: RegExp[] = [
  /\/blog(?:\/|$)/i,
  /\/news(?:\/|$)/i,
  /\/press(?:\/|$)/i,
  /\/terms(?:\/|$)?/i,
  /\/privacy(?:\/|$)?/i,
  /\/legal(?:\/|$)?/i,
  /\/cookie(?:\/|$)?/i,
  /\/careers?(?:\/|$)?/i,
  /\/jobs?(?:\/|$)?/i,
  /\/login(?:\/|$)?/i,
  /\/sign-?up(?:\/|$)?/i,
  /\/register(?:\/|$)?/i,
  /\/auth(?:\/|$)?/i,
  /\/docs(?:\/|$)?/i,
  /\/404(?:\/|$)?/i,
  /\/500(?:\/|$)?/i,
  /\.(?:pdf|png|jpe?g|svg|xml|json|gif|webp|ico|css|js|zip)(?:$|\?)/i,
];

function parseHttpUrl(value: string, context: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`[discover-pages] Invalid URL for ${context}: ${value}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `[discover-pages] URL for ${context} must use http or https: ${value}`,
    );
  }
  return parsed;
}

export function normalizeBaseUrl(inputUrl: string): string {
  const parsed = parseHttpUrl(inputUrl, "base");
  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = "";
  parsed.username = "";
  parsed.password = "";
  return parsed.toString().replace(/\/$/, "");
}

export function normalizePageUrl(inputUrl: string): string {
  const parsed = parseHttpUrl(inputUrl, "page");
  parsed.hash = "";
  parsed.search = "";
  parsed.username = "";
  parsed.password = "";
  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = normalizedPath === "" ? "/" : normalizedPath;
  return parsed.toString().replace(/\/$/, "");
}

export function isSameOrigin(url: string, baseUrl: string): boolean {
  return parseHttpUrl(url, "candidate").origin === parseHttpUrl(baseUrl, "base").origin;
}

export function shouldSkipUrl(url: string): boolean {
  return skipPatterns.some((pattern) => pattern.test(url));
}

export function classifyPage(url: string, baseUrl: string): PageType {
  const parsed = parseHttpUrl(url, "candidate");
  const base = parseHttpUrl(baseUrl, "base");
  const path = parsed.origin === base.origin ? parsed.pathname.toLowerCase() : "";
  if (path === "/" || path === "") {
    return "homepage";
  }
  if (/\/(?:pricing|plans|billing|buy)(?:\/|$)/i.test(path)) {
    return "pricing";
  }
  if (/\/(?:product|products|features|platform|solutions|services)(?:\/|$)/i.test(path)) {
    return "product";
  }
  if (/\/(?:customers|customer-stories|testimonials|reviews)(?:\/|$)/i.test(path)) {
    return "customers";
  }
  if (/\/(?:case-studies|case-study|stories)(?:\/|$)/i.test(path)) {
    return "case_study";
  }
  if (/\/(?:about|company|who-we-are)(?:\/|$)/i.test(path)) {
    return "about";
  }
  if (/\/(?:demo|contact|contact-sales|request-demo|trial)(?:\/|$)/i.test(path)) {
    return "demo";
  }
  return "other";
}

export function scorePage(url: string, baseUrl: string): number {
  const type = classifyPage(url, baseUrl);
  const typeScore: Record<PageType, number> = {
    homepage: 0,
    pricing: 10,
    product: 20,
    customers: 30,
    case_study: 40,
    about: 50,
    demo: 60,
    other: 90,
  };
  const pathDepth = parseHttpUrl(url, "candidate").pathname.split("/").filter(Boolean).length;
  return typeScore[type] + pathDepth;
}

export function fallbackPageCandidates(baseUrl: string): RawPageCandidate[] {
  const paths = [
    "",
    "/pricing",
    "/product",
    "/features",
    "/customers",
    "/case-studies",
    "/about",
    "/demo",
    "/contact-sales",
  ];
  return paths.map((path) => ({ url: `${baseUrl}${path}` }));
}

export function selectDiscoveredPages(
  baseUrl: string,
  candidates: RawPageCandidate[],
  limit = 12,
): SelectedPage[] {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const byUrl = new Map<string, RawPageCandidate>();

  for (const candidate of candidates) {
    const normalizedUrl = normalizePageUrl(candidate.url);
    if (!isSameOrigin(normalizedUrl, normalizedBaseUrl) || shouldSkipUrl(normalizedUrl)) {
      continue;
    }
    if (!byUrl.has(normalizedUrl)) {
      byUrl.set(normalizedUrl, {
        url: normalizedUrl,
        title: candidate.title,
        excerpt: candidate.excerpt,
      });
    }
  }

  if (!byUrl.has(normalizedBaseUrl)) {
    byUrl.set(normalizedBaseUrl, { url: normalizedBaseUrl });
  }

  return [...byUrl.values()]
    .sort((left, right) => {
      const scoreDelta = scorePage(left.url, normalizedBaseUrl) - scorePage(right.url, normalizedBaseUrl);
      return scoreDelta === 0 ? left.url.localeCompare(right.url) : scoreDelta;
    })
    .slice(0, limit)
    .map((candidate) => ({
      url: candidate.url,
      page_type: classifyPage(candidate.url, normalizedBaseUrl),
      title: candidate.title,
      excerpt: candidate.excerpt,
    }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readDiscoveryInput(inputPath: string): { baseUrl: string; candidates: RawPageCandidate[] } {
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf-8")) as unknown;
  if (Array.isArray(raw)) {
    const candidates = raw.map((item) => {
      if (typeof item !== "string") {
        throw new Error("[discover-pages] Array input must contain URL strings only.");
      }
      return { url: item };
    });
    if (candidates.length === 0) {
      throw new Error("[discover-pages] Array input must contain at least one URL.");
    }
    return { baseUrl: normalizeBaseUrl(candidates[0].url), candidates };
  }
  if (!isRecord(raw)) {
    throw new Error("[discover-pages] Input must be an array or object.");
  }
  const input = raw as DiscoveryInputObject;
  const baseUrl = input.base_url ?? input.input_url ?? input.urls?.[0] ?? input.pages?.[0]?.url;
  if (!baseUrl) {
    throw new Error("[discover-pages] Input object requires base_url, input_url, urls, or pages.");
  }
  const urlCandidates = input.urls?.map((url) => ({ url })) ?? [];
  const pageCandidates = input.pages ?? [];
  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    candidates: [...urlCandidates, ...pageCandidates],
  };
}

export function runDiscoverPagesCli(inputPath: string): void {
  const input = readDiscoveryInput(inputPath);
  const selected = selectDiscoveredPages(input.baseUrl, input.candidates);
  process.stdout.write(`${JSON.stringify(selected, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? fileURLToPath(new URL(`file://${process.argv[1]}`)) : "";
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  const inputPath = process.argv[2];
  if (!inputPath) {
    process.stderr.write("Usage: discover-pages.ts <discovery-input.json>\n");
    process.exit(2);
  }
  try {
    runDiscoverPagesCli(inputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
