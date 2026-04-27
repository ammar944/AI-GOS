/**
 * Drops category evidence that leaks excluded product or company names and records the rejection.
 */
import * as fs from "fs";
import {
  researchVocOutputSchema,
  type ExclusionTerm,
  type ResearchVocOutput,
  type Source,
} from "../schemas/output.ts";
import { findExcludedTerm } from "./build-exclusions.ts";

interface LeakageMatch {
  exclusion: ExclusionTerm;
  source: Source;
}

function sourceFromEntry(entry: Source): Source {
  return {
    source_url: entry.source_url,
    retrieved_at: entry.retrieved_at,
    ...(entry.source_title ? { source_title: entry.source_title } : {}),
  };
}

function matchEntry(
  entry: Source,
  values: Array<string | undefined>,
  terms: ExclusionTerm[],
): LeakageMatch | undefined {
  for (const value of values) {
    if (!value) {
      continue;
    }

    const exclusion = findExcludedTerm(value, terms);
    if (exclusion) {
      return { exclusion, source: sourceFromEntry(entry) };
    }
  }

  return undefined;
}

export function filterCompetitorLeakage(output: ResearchVocOutput): ResearchVocOutput {
  const terms = output.exclusion_terms;
  const rejected = [...output.rejected_competitor_matches];

  const record = (match: LeakageMatch): void => {
    rejected.push({
      ...match.source,
      rejected_term: match.exclusion.term,
      matched_competitor: match.exclusion.term,
    });
  };

  const categoryPainLanguage = output.category_pain_language.filter((entry) => {
    const match = matchEntry(
      entry,
      [entry.quote, entry.problem_space, entry.theme, entry.speaker_context, entry.source_title],
      terms,
    );
    if (match) {
      record(match);
      return false;
    }
    return true;
  });

  const statusQuoFrustrations = output.status_quo_frustrations.filter((entry) => {
    const match = matchEntry(
      entry,
      [entry.quote, entry.problem_space, entry.theme, entry.speaker_context, entry.source_title],
      terms,
    );
    if (match) {
      record(match);
      return false;
    }
    return true;
  });

  const objectionLanguage = output.objection_language.filter((entry) => {
    const match = matchEntry(
      entry,
      [entry.quote, entry.problem_space, entry.theme, entry.speaker_context, entry.source_title],
      terms,
    );
    if (match) {
      record(match);
      return false;
    }
    return true;
  });

  const workarounds = output.workarounds.filter((entry) => {
    const match = matchEntry(
      entry,
      [entry.workaround, entry.pain_it_reveals, entry.quote, entry.source_title],
      terms,
    );
    if (match) {
      record(match);
      return false;
    }
    return true;
  });

  const desiredOutcomes = output.desired_outcomes.filter((entry) => {
    const match = matchEntry(entry, [entry.claim, entry.source_title], terms);
    if (match) {
      record(match);
      return false;
    }
    return true;
  });

  return {
    ...output,
    category_pain_language: categoryPainLanguage,
    status_quo_frustrations: statusQuoFrustrations,
    objection_language: objectionLanguage,
    workarounds,
    desired_outcomes: desiredOutcomes,
    rejected_competitor_matches: rejected,
  };
}

function readOutput(path: string): ResearchVocOutput {
  const raw = JSON.parse(fs.readFileSync(path, "utf-8")) as unknown;
  const parsed = researchVocOutputSchema.safeParse(raw);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.map(String).join(":")} - ${issue.message}`)
      .join("\n");
    throw new Error(`Output schema validation failed before leakage filtering:\n${issues}`);
  }

  return parsed.data;
}

function main(): void {
  const outputPath = process.argv[2] ?? "./example/output.json";
  const output = readOutput(outputPath);
  const filtered = filterCompetitorLeakage(output);
  process.stdout.write(`${JSON.stringify(filtered, null, 2)}\n`);
}

if (process.argv[1]?.endsWith("filter-competitor-leakage.ts")) {
  main();
}
