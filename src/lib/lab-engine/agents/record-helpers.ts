// Pure record / string / URL helper utilities extracted from run-section.ts
// in Phase 5 as a dependency-free leaf, so both the staying normalizers and
// the extracted competitor-ad probe can import them without a cycle.

function getRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getStringProperty(
  value: Record<string, unknown> | null,
  key: string,
): string | null {
  const propertyValue = value?.[key];

  if (typeof propertyValue !== "string") {
    return null;
  }

  const trimmedValue = propertyValue.trim();
  return trimmedValue.length === 0 ? null : trimmedValue;
}

function getUrlProperty(
  value: Record<string, unknown> | null,
  key: string,
): string | null {
  const candidate = getStringProperty(value, key);
  if (candidate === null) {
    return null;
  }

  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

function dedupeRecordArrayByStringKey({
  key,
  value,
}: {
  key: string;
  value: unknown;
}): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  const seen = new Set<string>();

  return value.filter((item) => {
    const itemRecord = getRecord(item);
    const keyValue = getStringProperty(itemRecord, key);

    if (keyValue === null) {
      return true;
    }

    if (seen.has(keyValue)) {
      return false;
    }

    seen.add(keyValue);

    return true;
  });
}

function getValidHttpUrl(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function getSourceTitleFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");

    return `Evidence source: ${hostname}`;
  } catch {
    return "Evidence source";
  }
}

function collectStringValuesByKey(value: unknown, key: string): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringValuesByKey(item, key));
  }

  const record = getRecord(value);

  if (record === null) {
    return [];
  }

  const currentValue = getStringProperty(record, key);
  const childValues = Object.values(record).flatMap((item) =>
    collectStringValuesByKey(item, key),
  );

  return currentValue === null ? childValues : [currentValue, ...childValues];
}

function removeEmptyStringProperty(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = record[key];

  if (value === null) {
    return Object.fromEntries(
      Object.entries(record).filter(([entryKey]) => entryKey !== key),
    );
  }

  if (typeof value !== "string" || value.trim().length > 0) {
    return record;
  }

  return Object.fromEntries(
    Object.entries(record).filter(([entryKey]) => entryKey !== key),
  );
}

function getHostname(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export {
  getRecord,
  getStringProperty,
  getUrlProperty,
  dedupeRecordArrayByStringKey,
  getValidHttpUrl,
  getSourceTitleFromUrl,
  collectStringValuesByKey,
  removeEmptyStringProperty,
  getHostname,
};
