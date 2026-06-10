#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const REQUEST_TIMEOUT_MS = Number(process.env.API_DOCTOR_TIMEOUT_MS ?? "12000");
const CLI_TIMEOUT_MS = Number(process.env.API_DOCTOR_CLI_TIMEOUT_MS ?? "10000");

const SECRET_NAME_PATTERN =
  /(TOKEN|SECRET|KEY|PASSWORD|PASS|AUTH|PRIVATE|DATABASE_URL|SUPABASE_SERVICE_ROLE)/i;
const API_ENV_NAMES = [
  "DEEPSEEK_API_KEY",
  "ANTHROPIC_API_KEY",
  "PERPLEXITY_API_KEY",
  "FIRECRAWL_API_KEY",
  "BRAVE_SEARCH_API_KEY",
  "SEARCHAPI_KEY",
  "SPYFU_API_KEY",
  "FOREPLAY_API_KEY",
  "ENABLE_FOREPLAY",
];

function parseDotenv(content) {
  const env = new Map();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env.set(key, value);
  }

  return env;
}

function loadLocalEnv() {
  if (!existsSync(".env.local")) {
    return { source: ".env.local", available: false, names: new Set(), values: new Map() };
  }

  const values = parseDotenv(readFileSync(".env.local", "utf8"));
  for (const [key, value] of values) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    source: ".env.local",
    available: true,
    names: new Set(values.keys()),
    values,
  };
}

function scrub(value) {
  let output = String(value ?? "");

  for (const name of API_ENV_NAMES) {
    // non-secret flags (e.g. ENABLE_FOREPLAY=true) must not poison the scrubber
    if (!SECRET_NAME_PATTERN.test(name)) continue;
    const secret = process.env[name];
    if (secret && secret.length > 3) {
      output = output.split(secret).join(`[redacted:${name}]`);
    }
  }

  output = output.replace(
    /((?:sk|pk|key|token|secret|Bearer|Authorization)[_\w-]*[=:]\s*)["']?[^"',\s}]+/gi,
    "$1[redacted]",
  );
  output = output.replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/g, "[redacted:jwt]");
  output = output.replace(/[A-Za-z0-9_-]{32,}/g, "[redacted:token]");

  return output.slice(0, 500);
}

function classifyStatus(response, bodyText) {
  if (response.ok) return "ok";
  if (response.status === 401 || response.status === 403) return "auth_failed";
  if (response.status === 402) return "billing_or_quota";
  if (response.status === 408 || response.status === 504) return "timeout";
  if (response.status === 429) return "rate_limited_or_quota";
  if (/quota|credit|billing|fund|balance|limit/i.test(bodyText)) {
    return "billing_or_quota";
  }
  return "http_error";
}

async function requestProbe({ name, envName, url, init, parse }) {
  const key = process.env[envName]?.trim();
  if (!key) {
    return {
      name,
      status: "missing_credential",
      envName,
      detail: `${envName} is not configured locally`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init(key),
      signal: controller.signal,
    });
    const bodyText = await response.text().catch(() => "");
    const status = classifyStatus(response, bodyText);

    return {
      name,
      status,
      envName,
      httpStatus: response.status,
      detail: response.ok && parse ? parse(bodyText) : scrub(bodyText),
    };
  } catch (error) {
    return {
      name,
      status: error instanceof Error && error.name === "AbortError" ? "timeout" : "request_failed",
      envName,
      detail: scrub(error instanceof Error ? error.message : String(error)),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function jsonPost(headers, body) {
  return {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

function probes() {
  return [
    requestProbe({
      name: "DeepSeek",
      envName: "DEEPSEEK_API_KEY",
      url: "https://api.deepseek.com/chat/completions",
      init: (key) =>
        jsonPost(
          { Authorization: `Bearer ${key}` },
          {
            model: "deepseek-chat",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
            temperature: 0,
            stream: false,
          },
        ),
      parse: () => "chat completion accepted",
    }),
    requestProbe({
      name: "Anthropic",
      envName: "ANTHROPIC_API_KEY",
      url: "https://api.anthropic.com/v1/messages",
      init: (key) =>
        jsonPost(
          {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          {
            model: "claude-3-5-haiku-latest",
            max_tokens: 1,
            messages: [{ role: "user", content: "ping" }],
          },
        ),
      parse: () => "message accepted",
    }),
    requestProbe({
      name: "Perplexity",
      envName: "PERPLEXITY_API_KEY",
      url: "https://api.perplexity.ai/chat/completions",
      init: (key) =>
        jsonPost(
          { Authorization: `Bearer ${key}` },
          {
            model: "sonar",
            messages: [{ role: "user", content: "ping" }],
            // sonar rejects max_tokens < 16 with HTTP 400
            max_tokens: 16,
            temperature: 0,
            stream: false,
          },
        ),
      parse: () => "chat completion accepted",
    }),
    requestProbe({
      name: "Firecrawl",
      envName: "FIRECRAWL_API_KEY",
      url: "https://api.firecrawl.dev/v2/team/credit-usage",
      init: (key) => ({
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      }),
      parse: (bodyText) => scrub(bodyText),
    }),
    requestProbe({
      name: "Brave",
      envName: "BRAVE_SEARCH_API_KEY",
      url: "https://api.search.brave.com/res/v1/web/search?q=ping&count=1&country=US",
      init: (key) => ({
        method: "GET",
        headers: {
          "X-Subscription-Token": key,
          Accept: "application/json",
        },
      }),
      parse: () => "search accepted",
    }),
    requestProbe({
      name: "SearchAPI",
      envName: "SEARCHAPI_KEY",
      // plain google engine: 1-credit probe; google_trends requires a data_type param
      url: `https://www.searchapi.io/api/v1/search?engine=google&q=ping&num=1&api_key=${encodeURIComponent(
        process.env.SEARCHAPI_KEY?.trim() ?? "",
      )}`,
      init: () => ({
        method: "GET",
        headers: { Accept: "application/json" },
      }),
      parse: () => "google search accepted (1 credit)",
    }),
    requestProbe({
      name: "SpyFu",
      envName: "SPYFU_API_KEY",
      // domain-stats: 1-row probe on the endpoint the app actually uses (spyfu-client.ts)
      url: (() => {
        const now = new Date();
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const month = now.getMonth() === 0 ? 12 : now.getMonth();
        return `https://api.spyfu.com/apis/domain_stats_api/v2/getDomainStatsForExactDate?domain=spyfu.com&year=${year}&month=${month}&api_key=${encodeURIComponent(
          process.env.SPYFU_API_KEY?.trim() ?? "",
        )}`;
      })(),
      init: () => ({
        method: "GET",
        headers: { Accept: "application/json" },
      }),
      parse: () => "domain-stats probe accepted",
    }),
    requestProbe({
      name: "Foreplay",
      envName: "FOREPLAY_API_KEY",
      // must be a domain Foreplay actually tracks — generic domains return 400 "Domain is excluded"
      url: "https://public.api.foreplay.co/api/brand/getBrandsByDomain?domain=ramp.com&limit=1&order=most_ranked",
      init: (key) => ({
        method: "GET",
        headers: {
          Authorization: key,
          Accept: "application/json",
        },
      }),
      parse: () => "brand lookup accepted",
    }),
  ];
}

async function runCli(command, args, options = {}) {
  try {
    const { stdout } = await execFileAsync(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: {
        ...process.env,
        CI: "1",
        NO_COLOR: "1",
      },
      timeout: CLI_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });

    return { available: true, stdout };
  } catch (error) {
    return {
      available: false,
      reason: scrub(error instanceof Error ? error.message : String(error)),
    };
  }
}

function extractJsonObject(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const firstBracket = trimmed.indexOf("[");
    const start =
      firstBrace === -1
        ? firstBracket
        : firstBracket === -1
          ? firstBrace
          : Math.min(firstBrace, firstBracket);
    if (start === -1) return null;

    try {
      return JSON.parse(trimmed.slice(start));
    } catch {
      return null;
    }
  }
}

function collectNamesFromJson(value) {
  const names = new Set();

  function visit(node) {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    if (!node || typeof node !== "object") return;

    for (const key of ["key", "name", "variable", "variableName"]) {
      if (typeof node[key] === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(node[key])) {
        names.add(node[key]);
      }
    }

    for (const value of Object.values(node)) {
      visit(value);
    }
  }

  visit(value);
  return names;
}

function collectNamesFromText(text) {
  const names = new Set();
  const matcher = /\b[A-Z][A-Z0-9_]{2,}\b/g;
  for (const match of text.matchAll(matcher)) {
    names.add(match[0]);
  }
  return names;
}

function parseCliEnvNames(stdout) {
  const json = extractJsonObject(stdout);
  const names = json === null ? collectNamesFromText(stdout) : collectNamesFromJson(json);
  return new Set([...names].filter((name) => !/^(TRUE|FALSE|NULL|JSON)$/.test(name)));
}

async function getVercelEnvNames() {
  const jsonAttempt = await runCli("vercel", ["env", "ls", "production", "--json"]);
  if (jsonAttempt.available) {
    return {
      source: "Vercel production",
      available: true,
      names: parseCliEnvNames(jsonAttempt.stdout),
    };
  }

  const textAttempt = await runCli("vercel", ["env", "ls", "production"]);
  if (textAttempt.available) {
    return {
      source: "Vercel production",
      available: true,
      names: parseCliEnvNames(textAttempt.stdout),
    };
  }

  return {
    source: "Vercel production",
    available: false,
    names: new Set(),
    reason: jsonAttempt.reason,
  };
}

async function getRailwayEnvNames() {
  const attempts = [
    await runCli("railway", ["variables", "--json"]),
    await runCli("railway", ["variables"]),
    await runCli("railway", ["variables", "--json"], { cwd: "research-worker" }),
    await runCli("railway", ["variables"], { cwd: "research-worker" }),
  ];

  const available =
    attempts.find(
      (attempt) => attempt.available && parseCliEnvNames(attempt.stdout).size > 0,
    ) ?? attempts.find((attempt) => attempt.available);
  if (available) {
    return {
      source: "Railway",
      available: true,
      names: parseCliEnvNames(available.stdout),
    };
  }

  return {
    source: "Railway",
    available: false,
    names: new Set(),
    reason: attempts[0]?.reason ?? "railway CLI unavailable",
  };
}

function printProbeResults(results) {
  console.log("\nAPI probes");
  console.log("----------");
  for (const result of results) {
    const http = result.httpStatus ? ` http=${result.httpStatus}` : "";
    const detail = result.detail ? ` detail=${scrub(result.detail)}` : "";
    console.log(
      `${result.name.padEnd(10)} ${result.status.padEnd(22)} env=${result.envName}${http}${detail}`,
    );
  }
}

function printEnvDiff(sources) {
  console.log("\nEnv-name diff");
  console.log("-------------");

  for (const source of sources) {
    if (!source.available) {
      console.log(`${source.source}: unavailable (${source.reason ?? "not found"})`);
      continue;
    }
    console.log(`${source.source}: ${source.names.size} names`);
  }

  const availableSources = sources.filter((source) => source.available);
  const allNames = new Set(availableSources.flatMap((source) => [...source.names]));
  const interestingNames = [...allNames]
    .filter((name) => API_ENV_NAMES.includes(name) || SECRET_NAME_PATTERN.test(name))
    .sort();

  for (const name of interestingNames) {
    const present = availableSources
      .filter((source) => source.names.has(name))
      .map((source) => source.source)
      .join(", ");
    const missing = availableSources
      .filter((source) => !source.names.has(name))
      .map((source) => source.source)
      .join(", ");
    console.log(`${name}: present=[${present || "none"}] missing=[${missing || "none"}]`);
  }
}

async function main() {
  console.log("AI-GOS API doctor");
  console.log(`cwd=${process.cwd()}`);
  console.log(`timeoutMs=${REQUEST_TIMEOUT_MS}`);

  const localEnv = loadLocalEnv();
  const [probeResults, vercelEnv, railwayEnv] = await Promise.all([
    Promise.all(probes()),
    getVercelEnvNames(),
    getRailwayEnvNames(),
  ]);

  printProbeResults(probeResults);
  printEnvDiff([localEnv, vercelEnv, railwayEnv]);

  const hardFailures = probeResults.filter(
    (result) =>
      result.status !== "ok" &&
      result.status !== "missing_credential" &&
      result.status !== "request_failed" &&
      result.status !== "timeout",
  );

  if (hardFailures.length > 0) {
    console.log(
      `\nDoctor completed with provider findings: ${hardFailures
        .map((result) => `${result.name}:${result.status}`)
        .join(", ")}`,
    );
  } else {
    console.log("\nDoctor completed.");
  }
}

main().catch((error) => {
  console.error(`API doctor crashed: ${scrub(error instanceof Error ? error.stack ?? error.message : String(error))}`);
  process.exitCode = 1;
});
