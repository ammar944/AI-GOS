"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import { CheckCircle2, LockKeyhole, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getGtmPrefillReviewFields,
  gtmPrefillManifestSchema,
  type GtmPrefillManifest,
  type GtmPrefillReviewField,
} from "@/lib/gtm/onboarding/prefill";

export interface GtmPrefillReviewPanelProps {
  runId: string;
  prefill: GtmPrefillManifest | null;
  onConfirmed?: (prefill: GtmPrefillManifest) => void;
}

export function GtmPrefillReviewPanel({
  runId,
  prefill,
  onConfirmed,
}: GtmPrefillReviewPanelProps): ReactElement | null {
  const reviewFields = useMemo(() => {
    return prefill ? getGtmPrefillReviewFields(prefill) : [];
  }, [prefill]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    return buildFieldValueRecord(reviewFields);
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFieldValues(buildFieldValueRecord(reviewFields));
  }, [reviewFields]);

  if (!prefill) {
    return null;
  }

  if (prefill.status === "discovering") {
    return (
      <section className="rounded-lg border border-border bg-card px-4 py-4 shadow-sm">
        <div className="flex items-start gap-3">
          <Search className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-normal text-foreground">
              Website discovery is running
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Research sections stay locked until AIGOS turns verified website facts into a reviewable Product Identity draft.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (prefill.status === "confirmed") {
    return (
      <section className="rounded-lg border border-border bg-card px-4 py-4 shadow-sm">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-normal text-foreground">
              Product Identity confirmed
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Source-backed fields and user edits are saved to the GTM Brief draft. Downstream research can now be dispatched.
            </p>
          </div>
        </div>
      </section>
    );
  }

  async function confirmReview(): Promise<void> {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/gtm/runs/${encodeURIComponent(runId)}/prefill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "confirm_review",
          fields: fieldValues,
        }),
      });
      const payload = await readJson(response);

      if (!response.ok) {
        throw new Error(getPrefillErrorMessage(payload, response.status, runId));
      }

      if (!isRecord(payload)) {
        throw new Error(`Invalid prefill response for run_id=${runId}.`);
      }

      const parsed = gtmPrefillManifestSchema.safeParse(payload.prefill);
      if (!parsed.success) {
        throw new Error(`Invalid confirmed prefill payload for run_id=${runId}.`);
      }

      onConfirmed?.(parsed.data);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  function updateField(field: GtmPrefillReviewField, event: ChangeEvent<HTMLInputElement>): void {
    setFieldValues((previous) => {
      return {
        ...previous,
        [field.fieldKey]: event.target.value,
      };
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.06em] text-muted-foreground">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              Prefill review required
            </p>
            <h2 className="mt-2 text-base font-semibold tracking-normal text-foreground">
              Review Product Identity
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              <span>
                {reviewFields.length} website-backed {reviewFields.length === 1 ? "field" : "fields"} ready
              </span>
              <span className="block">
                Gaps stay open until you answer them.
              </span>
            </p>
          </div>
          <span className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
            {prefill.sourceGaps.length} gaps
          </span>
        </div>

        {reviewFields.length > 0 ? (
          <div className="flex flex-col divide-y divide-border rounded-md border border-border">
            {reviewFields.map((field) => (
              <label key={field.fieldKey} className="flex flex-col gap-2 px-3 py-3">
                <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-foreground">
                  {field.label}
                  <span className="font-mono text-xs uppercase text-muted-foreground">
                    {field.confidence}
                  </span>
                </span>
                <Input
                  aria-label={field.label}
                  disabled={submitting}
                  onChange={(event) => updateField(field, event)}
                  value={fieldValues[field.fieldKey] ?? field.value}
                />
                <span className="text-xs leading-5 text-muted-foreground">
                  Source: {getSourceLabel(field)}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-border px-3 py-3 text-sm text-muted-foreground">
            No website-backed fields are ready yet. Wait for discovery to finish or answer the missing fields manually.
          </p>
        )}

        {prefill.sourceGaps.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-foreground">Source gaps</h3>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {prefill.sourceGaps.slice(0, 4).map((gap) => (
                <li key={gap.id} className="rounded-md border border-border px-3 py-2">
                  {gap.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => {
              void confirmReview();
            }}
            disabled={submitting || reviewFields.length === 0}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
            {submitting ? "Saving..." : "Confirm reviewed draft"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function buildFieldValueRecord(fields: readonly GtmPrefillReviewField[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.fieldKey, field.value]));
}

function getSourceLabel(field: GtmPrefillReviewField): string {
  const source = field.sources.find((candidate) => {
    return candidate.source_type === "website_url" || candidate.source_type === "web_page";
  });

  return source?.url ?? source?.label ?? "website evidence";
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getPrefillErrorMessage(payload: unknown, status: number, runId: string): string {
  if (isRecord(payload) && typeof payload.message === "string") {
    return `Prefill review failed for run_id=${runId} status=${status}: ${payload.message}`;
  }

  if (isRecord(payload) && typeof payload.error === "string") {
    return `Prefill review failed for run_id=${runId} status=${status}: ${payload.error}`;
  }

  return `Prefill review failed for run_id=${runId} status=${status}.`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
