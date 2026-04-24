/**
 * Full-page PNG screenshot of the rendered HTML report, for preview in chat
 * clients or inclusion in slide decks.
 *
 * Uses Playwright if installed. Falls back to system Chrome via `puppeteer-core`
 * if available. If neither is present, exits cleanly with a helpful hint.
 *
 * Usage:
 *   npx tsx scripts/screenshot.ts <report.html> [screenshot.png]
 */
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";

async function tryPlaywright(htmlPath: string, pngPath: string): Promise<boolean> {
  try {
    // Dynamic import via Function breaks TS static module resolution — playwright
    // is an optionalDependency and may be absent at typecheck time.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-implied-eval
    const pw = (await (new Function("m", "return import(m)"))("playwright")) as any;
    const browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(pathToFileURL(path.resolve(htmlPath)).toString(), {
      waitUntil: "networkidle",
    });
    await page.screenshot({ path: pngPath, fullPage: true });
    await browser.close();
    return true;
  } catch (err) {
    const msg = (err as Error).message;
    if (/Cannot find module|ERR_MODULE_NOT_FOUND/.test(msg)) return false;
    if (/Executable doesn.t exist|browserType.launch/.test(msg)) {
      process.stderr.write(
        `[screenshot] playwright installed but Chromium is missing.\n` +
          `[screenshot]   run:  npx playwright install chromium\n`,
      );
      return false;
    }
    process.stderr.write(`[screenshot] playwright failed: ${msg}\n`);
    return false;
  }
}

async function tryPuppeteerCore(htmlPath: string, pngPath: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-implied-eval
    const pc = (await (new Function("m", "return import(m)"))("puppeteer-core")) as any;
    const chromePath = findSystemChrome();
    if (!chromePath) return false;
    const browser = await pc.default.launch({ executablePath: chromePath, headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(pathToFileURL(path.resolve(htmlPath)).toString(), {
      waitUntil: "networkidle0",
    });
    await page.screenshot({ path: pngPath, fullPage: true });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

function findSystemChrome(): string | null {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

async function main(): Promise<void> {
  const htmlPath = process.argv[2];
  const pngPath = process.argv[3] ?? htmlPath?.replace(/\.html?$/, ".png") ?? "";
  if (!htmlPath || !pngPath) {
    process.stderr.write("Usage: screenshot.ts <report.html> [screenshot.png]\n");
    process.exit(2);
  }
  if (!fs.existsSync(htmlPath)) {
    process.stderr.write(`[screenshot] missing: ${htmlPath}\n`);
    process.exit(1);
  }

  if (await tryPlaywright(htmlPath, pngPath)) {
    process.stdout.write(`[screenshot] wrote ${pngPath} (playwright)\n`);
    return;
  }
  if (await tryPuppeteerCore(htmlPath, pngPath)) {
    process.stdout.write(`[screenshot] wrote ${pngPath} (puppeteer-core + system chrome)\n`);
    return;
  }
  process.stderr.write(
    `[screenshot] skipped — no headless browser available.\n` +
      `[screenshot]   to enable, run one of:\n` +
      `[screenshot]     npm i -D playwright && npx playwright install chromium\n` +
      `[screenshot]     npm i -D puppeteer-core   # uses system Chrome\n`,
  );
  process.exit(0); // soft-fail — not a pipeline blocker
}

main().catch((err) => {
  process.stderr.write(`[screenshot] fatal: ${(err as Error).message}\n`);
  process.exit(0);
});
