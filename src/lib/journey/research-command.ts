export interface JourneyResearchCommand {
  rawInput: string;
  isResearchCommand: boolean;
  target: string | null;
  websiteUrl: string | null;
  displayText: string;
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return trimmed;
  }

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function normalizeResearchTarget(value: string): string {
  return stripWrappingQuotes(value).replace(/[.,;]+$/u, '').trim();
}

function normalizeWebsiteUrl(value: string): string | null {
  const target = normalizeResearchTarget(value);
  if (!target || /\s/u.test(target)) {
    return null;
  }

  const candidate = /^https?:\/\//iu.test(target) ? target : `https://${target}`;

  try {
    const url = new URL(candidate);
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') {
      return null;
    }

    const serialized = url.toString();
    if (url.pathname === '/' && !url.search && !url.hash) {
      return serialized.slice(0, -1);
    }

    return serialized;
  } catch {
    return null;
  }
}

export function parseJourneyResearchInput(input: string): JourneyResearchCommand {
  const rawInput = input.trim();
  const commandMatch = rawInput.match(/^\/?research(?:\s+(.+))?$/iu);
  const isResearchCommand = Boolean(commandMatch);
  const target = normalizeResearchTarget(
    isResearchCommand ? commandMatch?.[1] ?? '' : rawInput,
  );
  const normalizedTarget = target.length > 0 ? target : null;

  return {
    rawInput,
    isResearchCommand,
    target: normalizedTarget,
    websiteUrl: normalizedTarget ? normalizeWebsiteUrl(normalizedTarget) : null,
    displayText:
      isResearchCommand
        ? normalizedTarget
          ? `research ${normalizedTarget}`
          : 'research'
        : normalizedTarget
          ? `research ${normalizedTarget}`
          : '',
  };
}
