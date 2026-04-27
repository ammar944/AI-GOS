import * as fs from "fs";
import * as path from "path";
import { ingestUrlInputSchema, type IngestUrlInput } from "../schemas/input.ts";
import {
  ingestUrlOutputSchema,
  type DiscoveredPage,
  type IngestUrlOutput,
  type SourcedClaim,
} from "../schemas/output.ts";
import {
  normalizeBaseUrl,
  selectDiscoveredPages,
  type RawPageCandidate,
} from "./discover-pages.ts";
import {
  normalizePrefilledFields,
  parseRawPrefillFields,
  type RawPrefillField,
} from "./normalize-fields.ts";

interface FixtureSite {
  canonical_url: string;
  company_name: string;
  pages: RawPageCandidate[];
  raw_fields: RawPrefillField[];
  unresolved_fields: string[];
}

const retrievedAt = "2026-04-27T00:00:00.000Z";

function claim(value: string, sourceUrl: string): SourcedClaim {
  return {
    value,
    source_url: sourceUrl,
    retrieved_at: retrievedAt,
  };
}

const airtableHome = "https://www.airtable.com";
const airtablePricing = "https://www.airtable.com/pricing";
const airtableProduct = "https://www.airtable.com/product";
const airtableCustomers = "https://www.airtable.com/customers";
const airtableCaseStudies = "https://www.airtable.com/customer-stories";
const airtableAbout = "https://www.airtable.com/about";
const airtableDemo = "https://www.airtable.com/contact-sales";

const fixtureSites: Record<string, FixtureSite> = {
  [airtableHome]: {
    canonical_url: airtableHome,
    company_name: "Airtable",
    pages: [
      {
        url: airtableHome,
        title: "Airtable",
        excerpt: "Airtable is an app platform that connects people and data across business workflows.",
      },
      {
        url: `${airtableHome}/?utm_source=duplicate`,
        title: "Airtable duplicate homepage",
      },
      {
        url: airtablePricing,
        title: "Airtable Pricing",
        excerpt: "Airtable offers Free, Team, Business, and Enterprise Scale plans.",
      },
      {
        url: airtableProduct,
        title: "Airtable Product",
        excerpt: "Build apps on shared data and automate workflows across teams.",
      },
      {
        url: airtableCustomers,
        title: "Airtable Customers",
        excerpt: "Teams use Airtable to manage product operations, marketing, finance, and more.",
      },
      {
        url: airtableCaseStudies,
        title: "Airtable Customer Stories",
        excerpt: "Customer stories show how teams run workflows and operations on Airtable.",
      },
      {
        url: airtableAbout,
        title: "About Airtable",
        excerpt: "Airtable helps teams bring their data and workflows together.",
      },
      {
        url: airtableDemo,
        title: "Contact Sales",
        excerpt: "Airtable offers contact-sales paths for larger teams and enterprise needs.",
      },
      { url: `${airtableHome}/blog/company-news` },
      { url: `${airtableHome}/privacy` },
      { url: `${airtableHome}/login` },
      { url: `${airtableHome}/assets/logo.png` },
      { url: `${airtableHome}/sitemap.xml` },
    ],
    raw_fields: [
      {
        field_key: "companyName",
        label: "Company Name",
        value: "Airtable",
        confidence: "high",
        evidence: [claim("Airtable", airtableHome)],
        reason: "The company name is stated on the homepage.",
      },
      {
        field_key: "websiteUrl",
        value: airtableHome,
        confidence: "high",
        evidence: [claim(airtableHome, airtableHome)],
        reason: "Normalized from the submitted website URL.",
      },
      {
        field_key: "productDescription",
        value: "Airtable is an app platform for connecting people, data, and business workflows.",
        confidence: "high",
        evidence: [
          claim(
            "Airtable is an app platform that connects people and data across business workflows.",
            airtableHome,
          ),
        ],
        reason: "Homepage copy describes the product category and workflow use.",
      },
      {
        field_key: "targetCustomer",
        value: "Business teams that need shared apps, data, and workflow coordination.",
        confidence: "medium",
        evidence: [
          claim(
            "Teams use Airtable to manage product operations, marketing, finance, and more.",
            airtableCustomers,
          ),
        ],
        reason: "Customer page copy describes cross-functional business teams.",
      },
      {
        field_key: "valueProp",
        value: "Connect people and data across business workflows.",
        confidence: "high",
        evidence: [
          claim(
            "Airtable is an app platform that connects people and data across business workflows.",
            airtableHome,
          ),
        ],
        reason: "Legacy valueProp was normalized to corePromise from homepage copy.",
      },
      {
        field_key: "coreDeliverables",
        value: "Apps on shared data, workflow automation, and cross-team operational views.",
        confidence: "medium",
        evidence: [
          claim("Build apps on shared data and automate workflows across teams.", airtableProduct),
        ],
        reason: "Product page copy names the main deliverables.",
      },
      {
        field_key: "pricingModel",
        value: "subscription",
        confidence: "medium",
        evidence: [
          claim("Airtable offers Free, Team, Business, and Enterprise Scale plans.", airtablePricing),
        ],
        reason: "Plan tiers on the pricing page support a subscription pricing model.",
      },
      {
        field_key: "pricingTiers",
        value: "Free, Team, Business, and Enterprise Scale plans.",
        confidence: "high",
        evidence: [
          claim("Airtable offers Free, Team, Business, and Enterprise Scale plans.", airtablePricing),
        ],
        reason: "Pricing page lists public plan tiers.",
      },
      {
        field_key: "conversionPath",
        value: "freemium",
        confidence: "medium",
        evidence: [
          claim("Airtable offers Free, Team, Business, and Enterprise Scale plans.", airtablePricing),
        ],
        reason: "A public Free plan supports the freemium conversion path.",
      },
      {
        field_key: "salesMotion",
        value: "hybrid",
        confidence: "medium",
        evidence: [
          claim(
            "Airtable offers contact-sales paths for larger teams and enterprise needs.",
            airtableDemo,
          ),
        ],
        reason: "The site has public plans and a contact-sales path.",
      },
      {
        field_key: "industryVertical",
        value: "Work management and no-code application platform.",
        confidence: "medium",
        evidence: [
          claim("Build apps on shared data and automate workflows across teams.", airtableProduct),
        ],
        reason: "Product page copy supports the vertical framing.",
      },
      {
        field_key: "primaryIcpDescription",
        value: "Teams coordinating operations across product, marketing, finance, and other business functions.",
        confidence: "medium",
        evidence: [
          claim(
            "Teams use Airtable to manage product operations, marketing, finance, and more.",
            airtableCustomers,
          ),
        ],
        reason: "Customer page copy identifies cross-functional teams and use contexts.",
      },
      {
        field_key: "caseStudiesUrl",
        value: airtableCaseStudies,
        confidence: "high",
        evidence: [claim(airtableCaseStudies, airtableCaseStudies)],
        reason: "Customer stories page was discovered on the same domain.",
      },
      {
        field_key: "testimonialsUrl",
        value: airtableCustomers,
        confidence: "medium",
        evidence: [claim(airtableCustomers, airtableCustomers)],
        reason: "Customers page was discovered on the same domain.",
      },
      {
        field_key: "headquartersLocation",
        value: "San Francisco, California",
        confidence: "low",
        evidence: [claim("San Francisco, California", airtableAbout)],
        reason: "Legacy headquartersLocation was normalized to hqLocation.",
      },
    ],
    unresolved_fields: ["avgAcv", "topCompetitors"],
  },
};

function readInput(runDir: string): IngestUrlInput {
  const inputPath = path.join(runDir, "input.json");
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf-8")) as unknown;
  return ingestUrlInputSchema.parse(raw);
}

function loadFixtureSite(input: IngestUrlInput): FixtureSite {
  const canonicalInputUrl = normalizeBaseUrl(input.url);
  const fixture = fixtureSites[canonicalInputUrl];
  if (!fixture) {
    throw new Error(
      `[orchestrate] provider=fixture-site status=missing_fixture run_id=${input.run_id ?? "missing"} url=${canonicalInputUrl}`,
    );
  }
  return fixture;
}

function buildDiscoveredPages(fixture: FixtureSite): DiscoveredPage[] {
  const selected = selectDiscoveredPages(fixture.canonical_url, fixture.pages);
  return selected.map((page) => ({
    url: page.url,
    page_type: page.page_type,
    ...(page.title ? { title: claim(page.title, page.url) } : {}),
    ...(page.excerpt ? { excerpt: claim(page.excerpt, page.url) } : {}),
  }));
}

function buildOutput(input: IngestUrlInput, fixture: FixtureSite): IngestUrlOutput {
  const normalized = normalizePrefilledFields(
    parseRawPrefillFields(fixture.raw_fields),
    fixture.unresolved_fields,
  );
  const output = {
    run_id: input.run_id ?? `ingest-url-${new URL(fixture.canonical_url).hostname}`,
    stage: "discover-url",
    input_url: input.url,
    canonical_url: claim(fixture.canonical_url, fixture.canonical_url),
    company_name: claim(fixture.company_name, fixture.canonical_url),
    discovered_pages: buildDiscoveredPages(fixture),
    prefilled_fields: normalized.fields,
    unresolved_fields: normalized.unresolved_fields,
    generated_at: retrievedAt,
  };
  return ingestUrlOutputSchema.parse(output);
}

function writeOutput(runDir: string, output: IngestUrlOutput): void {
  const outputPath = path.join(runDir, "output.json");
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`[orchestrate] wrote ${outputPath}\n`);
}

function main(): void {
  const runDir = process.argv[2];
  if (!runDir) {
    process.stderr.write("Usage: orchestrate.ts <run_dir>\n");
    process.exit(2);
  }
  if (!fs.existsSync(runDir)) {
    process.stderr.write(`[orchestrate] run dir missing: ${runDir}\n`);
    process.exit(1);
  }
  try {
    const input = readInput(runDir);
    const fixture = loadFixtureSite(input);
    writeOutput(runDir, buildOutput(input, fixture));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

main();
