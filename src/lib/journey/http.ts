const HTML_DOCUMENT_PATTERN = /<!DOCTYPE html|<html[\s>]|<body[\s>]/i;
const CLERK_HTML_PATTERN = /clerk|x-clerk-auth-reason|protect-rewrite|lost in space\?/i;

function normalizeErrorText(raw: unknown): string {
  if (typeof raw === 'string') {
    return raw.trim();
  }

  if (raw instanceof Error) {
    return raw.message.trim();
  }

  if (raw && typeof raw === 'object' && 'error' in raw) {
    const errorValue = (raw as { error?: unknown }).error;
    if (typeof errorValue === 'string') {
      return errorValue.trim();
    }
  }

  return '';
}

function tryParseJsonError(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    return typeof parsed.error === 'string' ? parsed.error.trim() : null;
  } catch {
    return null;
  }
}

function htmlFallbackMessage(label: string, text: string): string {
  if (CLERK_HTML_PATTERN.test(text)) {
    return 'Your session could not be verified. Refresh the page and try again.';
  }

  return `${label} received an unexpected HTML response. Refresh the page and try again.`;
}

export function formatJourneyErrorMessage(
  raw: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const text = normalizeErrorText(raw);
  if (!text) {
    return fallback;
  }

  const jsonError = tryParseJsonError(text);
  if (jsonError) {
    return formatJourneyErrorMessage(jsonError, fallback);
  }

  if (HTML_DOCUMENT_PATTERN.test(text)) {
    return htmlFallbackMessage('Journey', text);
  }

  if (text.toLowerCase() === 'unauthorized') {
    return 'Your session expired. Refresh the page and try again.';
  }

  return text;
}

async function readResponseMessage(response: Response, label: string): Promise<string> {
  const text = (await response.text()).trim();

  if (!text) {
    if (response.status === 401) {
      return 'Your session expired. Refresh the page and try again.';
    }

    return `${label} failed. Please try again.`;
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('text/html') || HTML_DOCUMENT_PATTERN.test(text)) {
    return htmlFallbackMessage(label, text);
  }

  const jsonError = tryParseJsonError(text);
  if (jsonError) {
    return formatJourneyErrorMessage(jsonError);
  }

  return formatJourneyErrorMessage(text);
}

export function createJourneyGuardedFetch(label: string): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init);
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

    if (!response.ok) {
      throw new Error(await readResponseMessage(response, label));
    }

    if (contentType.includes('text/html')) {
      throw new Error(await readResponseMessage(response, label));
    }

    return response;
  };
}
