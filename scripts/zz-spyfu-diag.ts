import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const key = process.env.SPYFU_API_KEY ?? "";
const scrub = (s: unknown) => (key ? String(s).split(key).join("<KEY>") : String(s));
for (const m of ["log", "error", "warn"] as const) {
  const orig = console[m].bind(console);
  console[m] = (...a: unknown[]) => orig(...a.map(scrub));
}

async function main(): Promise<void> {
  try {
    const { getKeywordsByBulkSearch } = await import("@/lib/ai/spyfu-client");
    const rows = await getKeywordsByBulkSearch(["airtable"]);
    console.log("SUCCESS — rows:", rows.length, JSON.stringify(rows[0] ?? null).slice(0, 200));
  } catch (e) {
    console.log("FAILED —", scrub(e instanceof Error ? e.message : String(e)).slice(0, 600));
  }
}

void main();
