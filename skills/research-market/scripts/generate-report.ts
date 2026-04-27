/**
 * research-market - standalone HTML report generator
 *
 * Usage:
 *   npx tsx scripts/generate-report.ts <output.json> [report.html]
 */
import * as fs from "node:fs";
import { ResearchMarketOutputSchema, type ResearchMarketOutput } from "../schemas/output";

function escapeHtml(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return (text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderList(items: string[]): string {
  if (items.length === 0) return "<p class=\"muted\">None captured.</p>";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderSizeSignals(output: ResearchMarketOutput): string {
  if (output.market_size_signals.length === 0) {
    return "<p class=\"muted\">No defensible market sizing captured. See source gaps.</p>";
  }

  return output.market_size_signals
    .map(
      (signal) => `
        <article class="card">
          <h3>${escapeHtml(signal.label)} - ${escapeHtml(signal.market_scope)}</h3>
          <p>${escapeHtml(signal.value)}</p>
          <p class="muted">${escapeHtml(signal.basis)}${signal.period ? ` · ${escapeHtml(signal.period)}` : ""}</p>
          ${renderList(signal.caveats)}
          <a href="${escapeHtml(signal.source_url)}">${escapeHtml(signal.source_url)}</a>
        </article>
      `,
    )
    .join("");
}

function renderReport(output: ResearchMarketOutput): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(output.source_company_name)} market research</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #f8fafc; color: #111827; }
    main { max-width: 980px; margin: 0 auto; padding: 48px 24px; }
    header { border-bottom: 1px solid #d1d5db; margin-bottom: 32px; padding-bottom: 24px; }
    h1 { font-size: 40px; margin: 0 0 8px; }
    h2 { border-top: 1px solid #d1d5db; margin-top: 32px; padding-top: 24px; }
    .muted { color: #6b7280; }
    .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    code { background: #eef2ff; padding: 2px 6px; border-radius: 4px; }
    a { color: #1d4ed8; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="muted">research-market · <code>${escapeHtml(output.run_id)}</code> · ${escapeHtml(output.generated_at)}</p>
      <h1>${escapeHtml(output.source_company_name)}</h1>
      <p>${escapeHtml(output.summary)}</p>
    </header>

    <section>
      <h2>Market Scope</h2>
      <div class="card">
        <p><strong>Category:</strong> ${escapeHtml(output.market_scope.category)}</p>
        <p><strong>Buyer context:</strong> ${escapeHtml(output.market_scope.buyer_context ?? "not specified")}</p>
        <p><strong>Excluded scopes:</strong></p>
        ${renderList(output.market_scope.excluded_scopes)}
      </div>
    </section>

    <section>
      <h2>Key Findings</h2>
      ${renderList(output.keyFindings)}
    </section>

    <section>
      <h2>Market Size Signals</h2>
      <div class="grid">${renderSizeSignals(output)}</div>
    </section>

    <section>
      <h2>Demand Drivers</h2>
      ${renderList(output.marketDynamics.demandDrivers)}
    </section>

    <section>
      <h2>Source Gaps</h2>
      <div class="grid">
        ${output.source_gaps
          .map(
            (gap) => `
              <article class="card">
                <h3>${escapeHtml(gap.topic)}</h3>
                <p>${escapeHtml(gap.reason)}</p>
                <p class="muted">Needed evidence</p>
                ${renderList(gap.needed_evidence)}
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  </main>
</body>
</html>
`;
}

function readOutput(path: string): ResearchMarketOutput {
  const raw = JSON.parse(fs.readFileSync(path, "utf-8")) as unknown;
  const parsed = ResearchMarketOutputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `[generate-report] invalid output schema: ${JSON.stringify(parsed.error.issues, null, 2)}`,
    );
  }
  return parsed.data;
}

function main(): void {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] ?? "./report.html";

  if (!inputPath) {
    process.stderr.write("Usage: generate-report.ts <output.json> [report.html]\n");
    process.exit(2);
  }

  try {
    const output = readOutput(inputPath);
    fs.writeFileSync(outputPath, renderReport(output));
    process.stdout.write(`[generate-report] wrote ${outputPath}\n`);
  } catch (error: unknown) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(1);
  }
}

main();
