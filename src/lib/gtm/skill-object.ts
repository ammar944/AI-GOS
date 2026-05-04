import { generateObject, generateText, type RepairTextFunction } from "ai";
import { z } from "zod";
import { getGtmSkillLanguageModel } from "@/lib/gtm/skill-model";

export interface GenerateGtmSkillObjectOptions<Output> {
  schema: z.ZodType<Output>;
  schemaName: string;
  system: string;
  prompt: string;
  maxOutputTokens: number;
}

const JSON_ONLY_SYSTEM_INSTRUCTIONS = [
  "Return exactly one JSON object.",
  "Do not wrap the JSON in Markdown fences.",
  "Do not include prose, commentary, citations outside fields, or extra keys.",
  "Use only keys present in the supplied JSON Schema.",
  "For source_gaps.severity, use only info, warn, or blocker.",
  "For source_gaps.confidence, use an integer from 0 to 10.",
].join(" ");

export async function generateGtmSkillObject<Output>(
  options: GenerateGtmSkillObjectOptions<Output>
): Promise<Output> {
  const jsonSchema = z.toJSONSchema(options.schema);
  const result = await generateObject({
    model: getGtmSkillLanguageModel(),
    schema: options.schema,
    schemaName: options.schemaName,
    schemaDescription: `Strict JSON object matching ${options.schemaName}.`,
    system: `${options.system}\n\n${JSON_ONLY_SYSTEM_INSTRUCTIONS}`,
    prompt: buildSchemaPrompt(options),
    maxOutputTokens: options.maxOutputTokens,
    temperature: 0,
    providerOptions: getOllamaGenerationOptions(),
    experimental_repairText: buildRepairText({
      ...options,
      jsonSchema,
    }),
  });

  return result.object as Output;
}

export const repairGtmJsonText: RepairTextFunction = async ({ text }) => {
  return extractFirstJsonObject(text);
};

export function extractFirstJsonObject(text: string): string | null {
  const unfencedText = stripMarkdownJsonFence(text);

  if (isValidJsonObject(unfencedText)) {
    return unfencedText;
  }

  const firstBraceIndex = unfencedText.indexOf("{");

  if (firstBraceIndex === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = firstBraceIndex; index < unfencedText.length; index += 1) {
    const character = unfencedText[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = inString;
      continue;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === "{") {
      depth += 1;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        const candidate = unfencedText.slice(firstBraceIndex, index + 1);
        return isValidJsonObject(candidate) ? candidate : null;
      }
    }
  }

  return null;
}

function buildSchemaPrompt<Output>(
  options: GenerateGtmSkillObjectOptions<Output>
): string {
  return `${options.prompt}

You must return JSON matching this ${options.schemaName} contract:

${getSchemaContract(options.schemaName)}

Output rules:
- Return only the JSON object.
- Do not use Markdown fences in the final answer.
- Do not emit legacy aliases or snake_case substitutes when the schema requires another key.
- Do not invent facts to satisfy fields; use source_gaps for missing evidence.`;
}

function buildRepairText<Output>(
  options: GenerateGtmSkillObjectOptions<Output> & { jsonSchema: unknown }
): RepairTextFunction {
  return async ({ text }) => {
    const extractedJson = extractFirstJsonObject(text);

    if (extractedJson && validatesAgainstSchema(extractedJson, options.schema)) {
      return extractedJson;
    }

    const result = await generateText({
      model: getGtmSkillLanguageModel(),
      system: JSON_ONLY_SYSTEM_INSTRUCTIONS,
      prompt: `Repair the invalid ${options.schemaName} output below so it matches this JSON Schema exactly.

JSON Schema:
${JSON.stringify(options.jsonSchema, null, 2)}

Invalid output:
${text}

Return only the repaired JSON object.`,
      maxOutputTokens: options.maxOutputTokens,
      temperature: 0,
      providerOptions: getOllamaGenerationOptions(),
    });

    return extractFirstJsonObject(result.text);
  };
}

function validatesAgainstSchema<Output>(
  text: string,
  schema: z.ZodType<Output>
): boolean {
  try {
    return schema.safeParse(JSON.parse(text)).success;
  } catch {
    return false;
  }
}

function getOllamaGenerationOptions(): {
  ollama: { reasoningEffort: string; think: boolean };
} {
  return {
    ollama: {
      reasoningEffort: "low",
      think: false,
    },
  };
}

function getSchemaContract(schemaName: string): string {
  switch (schemaName) {
    case "IngestUrlOutput":
      return [
        "Top-level keys: run_id, stage, input_url, canonical_url, company_name, discovered_pages, prefilled_fields, unresolved_fields, source_gaps, generated_at.",
        'stage must be exactly "discover-url".',
        "canonical_url and company_name must be sourced claim objects: { value, source_url, retrieved_at }.",
        "discovered_pages must be an array of { url, page_type, title?, excerpt? }; title and excerpt are sourced claim objects when present.",
        "prefilled_fields must be an array of { field_key, label, value, confidence, evidence, reason }, not an object keyed by field name.",
        "Use camelCase GTM brief field_key values such as companyName, companyUrl, category, industryVertical, productDescription, targetCustomer, corePromise, coreDeliverables, pricingModel, pricingTiers, conversionPath, salesMotion, primaryIcpDescription, uniqueEdge, brandPositioning, caseStudies, or testimonials.",
        "Do not use snake_case field_key values such as company_name, website, product_description, pricing_model, or target_audience.",
        "prefilled_fields.confidence must be low, medium, or high.",
        "source_gaps must use { field, reason, remediation, severity, confidence }.",
      ].join("\n");
    case "IngestIdentityOutput":
      return [
        "Top-level keys: run_id, stage, company_name, domain, category, core_keywords, negative_keywords, sources, source_gaps, generated_at.",
        'stage must be exactly "ingest-identity".',
        "core_keywords and negative_keywords must be string arrays.",
        "sources must be an array of { source_url, retrieved_at, describes }.",
        "source_gaps must use { field, reason, remediation, severity, confidence }.",
      ].join("\n");
    case "ResearchMarketOutput":
      return [
        "Return the full research-market object with every required top-level key from the app schema.",
        'stage must be exactly "research-market".',
        "Every sourced market claim must include source_url, retrieved_at, and claim.",
        "Use arrays for market_size_signals, timing_signals, demand_drivers, buying_triggers, adoption_barriers, opportunity_candidates, key_findings, and source_gaps.",
        "source_gaps must use { field, reason, remediation, severity, confidence }.",
      ].join("\n");
    case "ResearchCompetitorOutput":
      return [
        "Return the full research-competitor object with every required top-level key from the app schema.",
        'stage must be exactly "research-competitor".',
        "competitor_set entries must include name, type, source_url, and retrieved_at.",
        "Use arrays for positioning_taxonomy, pricing_reality, review_mined_feedback, competitor_narrative_arc, paid_social_ad_inventory, paid_search_ad_inventory, ad_activity_signals, organic_vs_paid_narrative_delta, and source_gaps.",
        "source_gaps must use { field, reason, remediation, severity, confidence }.",
      ].join("\n");
    case "ResearchIcpOutput":
      return [
        "Return the full research-icp object with every required top-level key from the app schema.",
        'stage must be exactly "research-icp".',
        "Use arrays for persona_anchors, awareness_stages, job_titles, search_intent, buying_committee_notes, exclusions, and source_gaps.",
        "Do not emit priority scores, percentages, or unsupported numeric confidence values outside source_gaps.confidence.",
        "source_gaps must use { field, reason, remediation, severity, confidence }.",
      ].join("\n");
    default:
      return "Use the exact keys and value types required by the supplied app schema.";
  }
}

function stripMarkdownJsonFence(text: string): string {
  const trimmedText = text.trim();
  const fencedMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmedText);

  return fencedMatch ? fencedMatch[1].trim() : trimmedText;
}

function isValidJsonObject(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}
