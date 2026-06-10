const knownTwoLabelPublicSuffixes: ReadonlySet<string> = new Set([
  "co.uk",
  "com.au",
]);

export function parseUrlLike(input: string): URL | null {
  const trimmedInput = input.trim();

  if (trimmedInput.length === 0 || /\s/u.test(trimmedInput)) {
    return null;
  }

  const urlInput = /^[a-z][a-z0-9+.-]*:\/\//iu.test(trimmedInput)
    ? trimmedInput
    : `https://${trimmedInput}`;

  try {
    return new URL(urlInput);
  } catch {
    return null;
  }
}

function isValidHostname(hostname: string): boolean {
  const labels = hostname.split(".");

  if (labels.length < 2) {
    return false;
  }

  return labels.every(
    (label) =>
      /^[a-z0-9-]+$/u.test(label) &&
      !label.startsWith("-") &&
      !label.endsWith("-"),
  );
}

export function normalizeHostname(hostname: string): string | null {
  let normalized = hostname.trim().toLowerCase().replace(/\.$/u, "");

  while (normalized.startsWith("www.")) {
    normalized = normalized.slice(4);
  }

  return isValidHostname(normalized) ? normalized : null;
}

export function getRegistrableDomain(input: string): string | null {
  const parsedUrl = parseUrlLike(input);
  const hostname =
    parsedUrl === null ? null : normalizeHostname(parsedUrl.hostname);

  if (hostname === null) {
    return null;
  }

  const labels = hostname.split(".");
  const suffix = labels.slice(-2).join(".");

  if (knownTwoLabelPublicSuffixes.has(suffix)) {
    return labels.length >= 3 ? labels.slice(-3).join(".") : null;
  }

  return labels.slice(-2).join(".");
}

export function normalizeBrandToken(value: string): string {
  return value.replace(/[^a-z0-9]/giu, "").toLowerCase();
}

export function getRegistrableDomainBrandToken(domain: string): string {
  const registrableDomain = getRegistrableDomain(domain) ?? domain;
  const firstLabel = registrableDomain.split(".")[0] ?? "";

  return normalizeBrandToken(firstLabel);
}

export function isSameRegistrableDomain(
  left: string | undefined,
  right: string | undefined,
): boolean {
  if (left === undefined || right === undefined) {
    return false;
  }

  const leftDomain = getRegistrableDomain(left);
  const rightDomain = getRegistrableDomain(right);

  return leftDomain !== null && leftDomain === rightDomain;
}
