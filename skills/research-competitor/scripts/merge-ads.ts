/**
 * Merge batch ads output (from fetch-ads.ts --batch) into an existing
 * research-competitor output.json.
 *
 * Input shape (v2, multi-platform):
 *   [
 *     {
 *       "competitor": "Fireflies.ai",
 *       "platforms": [
 *         { "platform": "meta",     "paid_social_ad_inventory": {...}, "ad_activity_signals": {...} },
 *         { "platform": "linkedin", "paid_social_ad_inventory": {...}, "ad_activity_signals": {...} },
 *         { "platform": "google",   "paid_social_ad_inventory": {...}, "ad_activity_signals": {...} }
 *       ]
 *     }
 *   ]
 *
 * Overwrites `paid_social_ad_inventory` and `ad_activity_signals` on the main
 * JSON. Entries for platforms that returned 0 ads are retained (they show up
 * as dimmed posters in the report) so readers see the attempt was made.
 *
 * Usage:
 *   npx tsx scripts/merge-ads.ts <output.json> <ads.json>
 */
import * as fs from "fs";

interface PlatformEntry {
  platform: string;
  paid_social_ad_inventory: unknown;
  ad_activity_signals: unknown;
}

interface CompetitorEntry {
  competitor: string;
  platforms: PlatformEntry[];
}

function isV2(raw: unknown): raw is CompetitorEntry[] {
  return Array.isArray(raw) && raw.every((r) =>
    r && typeof r === "object" && Array.isArray((r as CompetitorEntry).platforms),
  );
}

function main(): void {
  const [outputPath, adsPath] = process.argv.slice(2);
  if (!outputPath || !adsPath) {
    process.stderr.write("Usage: merge-ads.ts <output.json> <ads.json>\n");
    process.exit(2);
  }
  const output = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
  const batch = JSON.parse(fs.readFileSync(adsPath, "utf-8"));

  let inventory: unknown[] = [];
  let signals: unknown[] = [];

  if (isV2(batch)) {
    for (const comp of batch) {
      for (const p of comp.platforms) {
        if (p.paid_social_ad_inventory) inventory.push(p.paid_social_ad_inventory);
        if (p.ad_activity_signals) signals.push(p.ad_activity_signals);
      }
    }
  } else if (Array.isArray(batch)) {
    // v1 fallback: flat array of { paid_social_ad_inventory, ad_activity_signals }
    inventory = batch.map((b: { paid_social_ad_inventory?: unknown }) => b.paid_social_ad_inventory).filter(Boolean);
    signals = batch.map((b: { ad_activity_signals?: unknown }) => b.ad_activity_signals).filter(Boolean);
  } else {
    process.stderr.write(`[merge-ads] ${adsPath} is not a recognized shape\n`);
    process.exit(1);
  }

  output.paid_social_ad_inventory = inventory;
  output.ad_activity_signals = signals;

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
  process.stdout.write(
    `[merge-ads] merged ${inventory.length} inventory + ${signals.length} signal fragment(s) into ${outputPath}\n`,
  );
}

main();
