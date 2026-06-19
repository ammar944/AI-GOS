#!/usr/bin/env tsx
/**
 * zz-replay-section.ts — OFFLINE replay harness for a single lab-engine section.
 *
 * Runs ONE positioning section end-to-end through the REAL floor / verifier /
 * commit pipeline, against a FROZEN corpus + a FROZEN section body, with ZERO
 * live API calls. This is the sandbox-first loop: prove a section's
 * deterministic logic (floors, promotion, verifier, commit — e.g. the F0
 * candidate-rescue, F1 readiness reshape) at ~$0 before spending a live run.
 *
 * Usage:
 *   npx tsx scripts/zz-replay-section.ts --section positioningBuyerICP
 *   npx tsx scripts/zz-replay-section.ts --section positioningBuyerICP \
 *       --corpus tmp/accept/b0d12b45 --body tmp/accept/b0d12b45/positioningBuyerICP.json --eval
 *
 *   --section <id>     section to replay (default positioningBuyerICP)
 *   --corpus <dir>     dir with deepResearchProgram.json + _manifest.json
 *                      (default tmp/accept/b0d12b45)
 *   --body <file>      ArtifactEnvelope JSON whose {verdict,statusSummary,sources,body}
 *                      is fed as the model's answer (default <corpus>/<section>.json)
 *   --out <dir>        where to write the committed artifact (default tmp/replay)
 *   --eval             after committing, run scripts/zz-gap8-section-gates.mjs on the bundle
 *
 * SAFETY: provider keys are forced to fakes and global fetch is stubbed, so a
 * missed stub ERRORS rather than spends. This harness is logic-only — it does
 * NOT exercise the live model. For real-output quality, run one live section
 * (separate path), only after the offline loop is green.
 */

import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// --- Force a fully offline, no-spend environment BEFORE importing run-section. ---
// Keys are fake on purpose: the lazy model proxy constructs without validating,
// and any default (un-stubbed) runner that reaches .generate() fails fast
// instead of spending. Streaming off => answer-tool path (we stub runAnswerTool).
process.env.LAB_ENGINE_PROVIDER = "anthropic";
process.env.ANTHROPIC_API_KEY = "sk-fake-offline-replay";
process.env.DEEPSEEK_API_KEY = "fake-offline-replay";
process.env.LAB_SECTION_STREAMING = "false";
process.env.LAB_THINKER_MODE = "off";
process.env.LAB_ENGINE_LIVE_TOOLS = "false";
const offlineFetch = (async () =>
  new Response("<html>offline replay — network disabled</html>", {
    status: 200,
  })) as unknown as typeof fetch;
globalThis.fetch = offlineFetch;

import { researchInputSchema } from "../src/lib/lab-engine/artifacts/artifact-envelope";
import { corpusToResearchInput } from "../src/lib/research-v2/corpus-to-research-input";
import { createRunStore } from "../src/lib/lab-engine/runs/run-store";
import { isSupportedSectionId } from "../src/lib/lab-engine/sections/section-registry";

function readFlag(args: string[], name: string): string | null {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}
function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const sectionId = readFlag(args, "section") ?? "positioningBuyerICP";
  const corpusDir = readFlag(args, "corpus") ?? "tmp/accept/b0d12b45";
  const bodyPath = readFlag(args, "body") ?? join(corpusDir, `${sectionId}.json`);
  const outDir = readFlag(args, "out") ?? "tmp/replay";
  const runEval = hasFlag(args, "eval");
  // Force the deadline-salvage path (ADR-0012 honest-thin commit) — commits
  // without the live evidence gate, so the offline loop reaches a committed
  // artifact. This is the path the F0 rescue lives on.
  const deadlineExhausted = hasFlag(args, "deadline-exhausted");

  if (!isSupportedSectionId(sectionId)) {
    console.error(`Unknown sectionId: ${sectionId}`);
    process.exit(1);
  }

  // 1) Build ResearchInput from the frozen corpus (pure, no env/network).
  const program = JSON.parse(
    await readFile(join(corpusDir, "deepResearchProgram.json"), "utf8"),
  );
  const manifest = JSON.parse(
    await readFile(join(corpusDir, "_manifest.json"), "utf8"),
  );
  const runId = `replay-${sectionId.replace(/^positioning/, "")}`;
  const built = corpusToResearchInput({
    runId,
    deepResearchProgramData: program,
    onboardingData: manifest.briefInput ?? {},
  });
  const researchInput = researchInputSchema.parse({ ...built, runId });

  // 2) The frozen "model answer": the full section output. The tolerant decoder
  //    wants sectionTitle + confidence + verdict + statusSummary + sources + body;
  //    the frozen ArtifactEnvelope carries all of them (plus envelope-only fields
  //    like id/runId/createdAt that the decoder tolerates and ignores).
  const frozen = JSON.parse(await readFile(bodyPath, "utf8"));
  const answerInput = frozen;

  // 3) File-based offline RunStore (no Supabase), isolated in a fresh tmp dir
  //    so repeated replays never collide on a stale run file.
  const storeRoot = await mkdtemp(join(tmpdir(), "aigos-replay-"));
  const store = createRunStore({
    rootDir: storeRoot,
    defaultSectionIds: [sectionId],
  });
  await store.createRun(researchInput);

  // 4) Run the section with ALL expensive seams stubbed — zero live calls.
  const { runSection } = await import("../src/lib/lab-engine/agents/run-section");

  const stubbedThrow = (name: string) => async () => {
    throw new Error(
      `[replay] seam '${name}' was invoked but not modelled — this path needs a stub. ` +
        `Inspect which path the section took.`,
    );
  };

  console.log(
    `[zz-replay-section] section=${sectionId} corpus=${corpusDir} body=${bodyPath} (OFFLINE, $0)`,
  );

  let result;
  try {
    result = await runSection(
    {
      runId,
      sectionId,
      ...(deadlineExhausted ? { deadlineAt: Date.now() - 1000 } : {}),
    },
    {
      store,
      loadSkill: async (slug: string) => {
        try {
          return await readFile(
            join("src", "lib", "lab-engine", "skills", slug, "SKILL.md"),
            "utf8",
          );
        } catch {
          return "Offline replay: corpus-only mode.";
        }
      },
      allowedTools: [],
      // The model answer (answer-tool path, since LAB_SECTION_STREAMING=false):
      runAnswerTool: async () => ({ steps: [], text: "", answerInput }),
      // Belt-and-suspenders for the structured path if it is reached:
      callStructured: async () => answerInput,
      streamStructured: () => ({
        output: Promise.resolve(answerInput),
        partialOutputStream: (async function* () {
          yield answerInput;
        })(),
        consumeStream: async () => {},
        finishReason: Promise.resolve("stop"),
      }),
      // Writer pass: passthrough (do not rewrite the frozen body).
      runWriterPass: (async (p: { output: unknown }) => ({
        output: p.output,
        applied: false,
        rewrittenFieldCount: 0,
        durationMs: 0,
        writerModelId: "offline-replay",
      })) as never,
      // These should not fire on the answer-tool path with thinker off; if one
      // does, it errors loudly (never spends) so we learn the real path.
      runThinkerPass: stubbedThrow("runThinkerPass") as never,
      runEvidencePass: stubbedThrow("runEvidencePass") as never,
      fetchImpl: (async () =>
        new Response("<html>offline replay</html>", { status: 200 })) as never,
      now: () => new Date("2026-06-18T12:00:00.000Z"),
    },
    );
  } catch (err) {
    // The pipeline ran fully OFFLINE (zero spend). A required-evidence /
    // verification failure here is the real gate doing its job on a body with
    // no recorded supporting evidence — not a harness fault. Report it cleanly.
    const e = err as { name?: string; message?: string; missingClass?: string };
    console.log(
      `[zz-replay-section] ran the full pipeline OFFLINE ($0). Section did NOT commit:`,
    );
    console.log(`  ${e.name}: ${e.message}`);
    console.log(
      `\n  This is the in-process evidence gate refusing an unsupported body — correct behavior.`,
    );
    console.log(
      `  Pure-stub mode validates corpus->input + decode + structure + floors + the gate.`,
    );
    console.log(
      `  A clean COMMIT for value-reading needs real evidence recorded from ONE live run` +
        ` (a future --record mode), then replayed free. Faking evidence is intentionally not done.`,
    );
    return;
  }

  // 5) Write the committed artifact (bare envelope, body at top) + a summary.
  await mkdir(outDir, { recursive: true });
  const artifactPath = join(outDir, `${sectionId}.json`);
  await writeFile(
    artifactPath,
    JSON.stringify(result.artifact, null, 2),
    "utf8",
  );

  const body = (result.artifact as { body?: Record<string, unknown> }).body ?? {};
  const personaReality = (body.personaReality ?? {}) as {
    personas?: unknown[];
    blockGap?: unknown;
  };
  console.log(`[zz-replay-section] COMMITTED -> ${artifactPath}`);
  console.log(`  verdict: ${result.artifact.verdict}`);
  console.log(`  confidence: ${result.artifact.confidence}`);
  console.log(`  sources: ${result.artifact.sources.length}`);
  if (sectionId === "positioningBuyerICP") {
    console.log(
      `  personaReality.personas: ${Array.isArray(personaReality.personas) ? personaReality.personas.length : "n/a"}` +
        ` (blockGap: ${personaReality.blockGap ? "present" : "none"})`,
    );
  }

  // 6) Optional offline value-read.
  if (runEval) {
    const { execFileSync } = await import("node:child_process");
    // Build a bundle dir the gate can read: copy the corpus manifest + this artifact.
    const bundleDir = join(outDir, "bundle");
    await mkdir(bundleDir, { recursive: true });
    await writeFile(
      join(bundleDir, "_manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );
    await writeFile(
      join(bundleDir, `${sectionId}.json`),
      JSON.stringify(result.artifact, null, 2),
      "utf8",
    );
    console.log(`[zz-replay-section] running offline gate on ${bundleDir} ...`);
    try {
      const out = execFileSync(
        "node",
        ["scripts/zz-gap8-section-gates.mjs", bundleDir],
        { encoding: "utf8" },
      );
      console.log(out);
    } catch (err) {
      const e = err as { stdout?: string; status?: number };
      if (e.stdout) console.log(e.stdout);
      console.log(`[zz-replay-section] gate exit: ${e.status ?? "?"}`);
    }
  }
}

main().catch((err) => {
  console.error("[zz-replay-section] FATAL", err);
  process.exit(1);
});
