#!/usr/bin/env tsx
/**
 * zz-provenance-gate.ts — CLI front-end for the Phase B deterministic provenance
 * detector (scripts/provenance/gate.ts).
 *
 * Runs the 5 checks over the frozen GLM artifacts in
 *   tmp/zz-agentic-glm/<subject>/<section>/{body.md,transcript.json}
 *
 * Usage:
 *   npx tsx scripts/zz-provenance-gate.ts --subject plain --section voc --detect-only
 *   npx tsx scripts/zz-provenance-gate.ts --all --detect-only
 *   npx tsx scripts/zz-provenance-gate.ts --subject attio --section buyer --remediate
 *
 * Flags:
 *   --subject <slug>   plain | fathom | attio
 *   --section <name>   voc | market | buyer | competitor | offer | demand | paidmedia
 *   --all              run every subject×section pair (21 cells)
 *   --detect-only      print STRICT JSON to STDOUT (logs to STDERR), no writes.
 *                      Single cell  -> {subject,section,violations,stats}
 *                      --all         -> {cells:[{subject,section,violations,stats}], summary}
 *   --remediate        invoke the GLM convergence remediation pass (scripts/zz-provenance-remediate.ts)
 *
 * --detect-only is the machine-readable contract the verify phase parses:
 * NOTHING goes to stdout except the JSON object. All progress/logging -> stderr.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { detect, ceilingFor, type DetectResult } from "./provenance/gate";

const ART_ROOT = "tmp/zz-agentic-glm";
const SUBJECTS = ["plain", "fathom", "attio"] as const;
const SECTIONS = ["voc", "market", "buyer", "competitor", "offer", "demand", "paidmedia"] as const;
// paidmedia is a SYNTHESIS section: it carries forward the other 6 sections' facts but its
// own transcript only ad-probes. Fold the sibling transcripts into its grounding index.
const UPSTREAM_SECTIONS = ["voc", "market", "buyer", "competitor", "offer", "demand"] as const;

type Subject = (typeof SUBJECTS)[number];
type Section = (typeof SECTIONS)[number];

function log(...args: unknown[]): void {
  // STDERR only — keeps stdout clean for the --detect-only JSON contract.
  console.error(...args);
}

interface Args {
  subject?: string;
  section?: string;
  all: boolean;
  detectOnly: boolean;
  remediate: boolean;
  root: string;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { all: false, detectOnly: false, remediate: false, root: ART_ROOT };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--subject") a.subject = argv[++i];
    else if (t === "--section") a.section = argv[++i];
    else if (t === "--all") a.all = true;
    else if (t === "--detect-only") a.detectOnly = true;
    else if (t === "--remediate") a.remediate = true;
    else if (t === "--root") a.root = argv[++i];
  }
  return a;
}

interface CellResult {
  subject: string;
  section: string;
  violations: DetectResult["violations"];
  stats: DetectResult["stats"];
  ceiling: number;
}

function detectCell(root: string, subject: string, section: string): CellResult {
  const dir = resolve(process.cwd(), root, subject, section);
  const bodyPath = `${dir}/body.md`;
  const transcriptPath = `${dir}/transcript.json`;
  if (!existsSync(bodyPath) || !existsSync(transcriptPath)) {
    throw new Error(`missing artifact: ${bodyPath} or ${transcriptPath}`);
  }
  let siblingTranscripts: string[] | undefined;
  let siblingBodies: string[] | undefined;
  if (section === "paidmedia") {
    siblingTranscripts = [];
    siblingBodies = [];
    for (const up of UPSTREAM_SECTIONS) {
      const sp = resolve(process.cwd(), root, subject, up, "transcript.json");
      if (existsSync(sp)) siblingTranscripts.push(readFileSync(sp, "utf8"));
      // FIX 4 — fold the sibling section BODIES into the URL/quote grounding corpus so
      // legitimate carry-forward prose (gap disclosures, break-point headings) clears.
      const bp = resolve(process.cwd(), root, subject, up, "body.md");
      if (existsSync(bp)) siblingBodies.push(readFileSync(bp, "utf8"));
    }
  }
  const { violations, stats } = detect({
    bodyPath,
    transcriptPath,
    section,
    subject,
    siblingTranscripts,
    siblingBodies,
  });
  return { subject, section, violations, stats, ceiling: ceilingFor(violations) };
}

function emit(obj: unknown): void {
  // The ONLY thing written to stdout.
  process.stdout.write(JSON.stringify(obj) + "\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.remediate) {
    // Delegate to the GLM convergence pass. Lazy-import so the detector path
    // never depends on the AI-SDK/Ollama wiring.
    log("[remediate] delegating to scripts/zz-provenance-remediate.ts …");
    const { remediateCell } = await import("./zz-provenance-remediate");
    if (!args.subject || !args.section) {
      log("[error] --remediate requires --subject and --section");
      process.exit(2);
    }
    const res = await remediateCell({
      root: args.root,
      subject: args.subject,
      section: args.section,
    });
    log(`[remediate] done: ${res.rounds} round(s), ${res.surviving} surviving violation(s)`);
    return;
  }

  if (args.all) {
    const cells: CellResult[] = [];
    for (const subject of SUBJECTS) {
      for (const section of SECTIONS) {
        try {
          cells.push(detectCell(args.root, subject, section));
        } catch (e) {
          log(`[skip] ${subject}/${section}: ${(e as Error).message}`);
        }
      }
    }
    const summary = {
      totalCells: cells.length,
      cellsWithViolations: cells.filter((c) => c.violations.length > 0).length,
      totalViolations: cells.reduce((n, c) => n + c.violations.length, 0),
      byCheck: cells
        .flatMap((c) => c.violations.map((v) => v.check))
        .reduce<Record<string, number>>((acc, k) => ((acc[k] = (acc[k] ?? 0) + 1), acc), {}),
    };
    if (args.detectOnly) {
      emit({ cells, summary });
    } else {
      log(JSON.stringify({ cells, summary }, null, 2));
    }
    return;
  }

  if (!args.subject || !args.section) {
    log("[error] need --subject and --section (or --all)");
    log("subjects:", SUBJECTS.join(", "), "| sections:", SECTIONS.join(", "));
    process.exit(2);
  }

  const cell = detectCell(args.root, args.subject, args.section);
  if (args.detectOnly) {
    // STRICT JSON contract for the verify phase.
    emit({
      subject: cell.subject,
      section: cell.section,
      violations: cell.violations,
      stats: cell.stats,
    });
  } else {
    log(
      `[detect] ${cell.subject}/${cell.section}: ${cell.violations.length} violation(s), ceiling=${cell.ceiling}`,
    );
    for (const v of cell.violations) {
      log(`  - [${v.check}] (${v.severity}, ceil ${v.ceiling}) ${v.span}`);
      log(`      ${v.reason}`);
    }
    log(`  stats: ${JSON.stringify(cell.stats)}`);
  }
}

main().catch((e) => {
  log(`[fatal] ${(e as Error).stack ?? e}`);
  process.exit(1);
});
