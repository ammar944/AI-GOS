'use client';

import { useMemo, useState, type ReactElement } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { buildOnboardingReviewMetadata } from '@/lib/research-v2/onboarding-review';
import {
  EMPTY_ONBOARDING_V2,
  OnboardingV2Schema,
  SECTION_META,
  type OnboardingFieldReview,
  type OnboardingFieldReviewState,
  type OnboardingPrefillMetadata,
  type OnboardingReviewMetadata,
  type OnboardingV2Data,
  type SalesProcessDocRef,
  type SectionField,
} from '@/lib/research-v2/onboarding-v2-types';

interface OnboardingWizardV2Props {
  initialData?: Partial<OnboardingV2Data>;
  initialPrefillMetadata?: OnboardingPrefillMetadata;
  onComplete: (
    data: OnboardingV2Data,
    reviewMetadata: OnboardingReviewMetadata,
  ) => void;
}

const STATE_CLASS: Record<OnboardingFieldReviewState, string> = {
  'AI-filled': 'border-[var(--accent-green)] text-[color:var(--accent-green)]',
  'User-edited': 'border-[var(--accent-blue)] text-[color:var(--accent-blue)]',
  Missing: 'border-[var(--accent-red)] text-[color:var(--accent-red)]',
  'Needs review': 'border-[var(--accent-amber)] text-[color:var(--accent-amber)]',
};

const SALES_PROCESS_DOC_LABELS = [
  'Process overview',
  'SDR outreach SOP',
  'Opt-in follow-up SOP',
  'Personalization SOP',
] as const;

function buildSalesProcessDocRows(
  docs: readonly SalesProcessDocRef[],
): SalesProcessDocRef[] {
  return SALES_PROCESS_DOC_LABELS.map((defaultLabel, index) => {
    const existing = docs[index];
    return {
      label: existing?.label ?? defaultLabel,
      url: existing?.url ?? '',
    };
  });
}

function pinnedLabel(review: OnboardingFieldReview): string {
  if (review.key === 'idealCustomer') return 'Ideal Customer';
  return review.label;
}

function FieldStateBadge({
  state,
}: {
  state: OnboardingFieldReviewState;
}): ReactElement {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center rounded-full border px-2 font-mono text-[10px] uppercase tracking-[0.06em]',
        STATE_CLASS[state],
      )}
    >
      {state}
    </span>
  );
}

export function OnboardingWizardV2({
  initialData,
  initialPrefillMetadata = {},
  onComplete,
}: OnboardingWizardV2Props): ReactElement {
  const [data, setData] = useState<OnboardingV2Data>({
    ...EMPTY_ONBOARDING_V2,
    ...initialData,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const review = useMemo(
    () => buildOnboardingReviewMetadata(data, initialPrefillMetadata),
    [data, initialPrefillMetadata],
  );

  const pinnedReviews = review.pinnedFieldKeys
    .map((key) => review.fields[key])
    .filter((field): field is OnboardingFieldReview => Boolean(field));

  function setField<K extends keyof OnboardingV2Data>(
    key: K,
    value: OnboardingV2Data[K],
  ): void {
    setData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function toggleChannel(value: string): void {
    setData((prev) => {
      const channels = prev.channels.includes(value)
        ? prev.channels.filter((channel) => channel !== value)
        : [...prev.channels, value];
      return { ...prev, channels };
    });
    if (errors.channels) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.channels;
        return next;
      });
    }
  }

  function updateSalesProcessDoc(
    index: number,
    key: keyof SalesProcessDocRef,
    value: string,
  ): void {
    setData((prev) => {
      const docs = buildSalesProcessDocRows(prev.salesProcessDocs);
      docs[index] = { ...docs[index], [key]: value };
      return { ...prev, salesProcessDocs: docs };
    });
    if (errors.salesProcessDocs) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.salesProcessDocs;
        return next;
      });
    }
  }

  function handleSubmit(): void {
    const parsed = OnboardingV2Schema.safeParse(data);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    onComplete(parsed.data, review);
  }

  function renderField(field: SectionField): ReactElement {
    const reviewField = review.fields[field.key];
    const state = reviewField?.state ?? 'Missing';
    const error = errors[field.key as string];
    const fieldId = field.key as string;

    const label = (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Label htmlFor={fieldId} className="text-sm font-medium leading-snug">
          {field.label}
          {field.required ? (
            <span className="ml-0.5 text-destructive">*</span>
          ) : (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {field.description ?? '(optional)'}
            </span>
          )}
        </Label>
        <FieldStateBadge state={state} />
      </div>
    );

    return (
      <div
        key={fieldId}
        data-testid={`onboarding-field-${fieldId}`}
        className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4"
      >
        <div className="space-y-3">
          {label}
          {renderFieldControl(field)}
          {reviewField?.sourceUrl ? (
            <div className="break-all font-mono text-[10px] text-[color:var(--text-tertiary)]">
              Source: {reviewField.sourceUrl}
            </div>
          ) : null}
          {reviewField?.reasoning ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {reviewField.reasoning}
            </p>
          ) : null}
          {error ? (
            <Alert variant="destructive" className="px-3 py-2">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>
    );
  }

  function renderFieldControl(field: SectionField): ReactElement {
    const fieldId = field.key as string;
    const error = errors[fieldId];

    if (field.type === 'radio') {
      return (
        <RadioGroup
          value={(data[field.key] as string) ?? ''}
          onValueChange={(value) => setField(field.key, value as never)}
          className="grid gap-2 pt-1 sm:grid-cols-2"
        >
          {field.options?.map((option) => (
            <div key={option.value} className="flex min-h-9 items-center gap-2">
              <RadioGroupItem value={option.value} id={`${fieldId}-${option.value}`} />
              <Label
                htmlFor={`${fieldId}-${option.value}`}
                className="cursor-pointer text-sm font-normal leading-snug"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <div className="grid gap-2 pt-1 sm:grid-cols-2">
          {field.options?.map((option) => (
            <div key={option.value} className="flex min-h-9 items-center gap-2">
              <Checkbox
                id={`${fieldId}-${option.value}`}
                checked={data.channels.includes(option.value)}
                onCheckedChange={() => toggleChannel(option.value)}
              />
              <Label
                htmlFor={`${fieldId}-${option.value}`}
                className="cursor-pointer text-sm font-normal leading-snug"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      );
    }

    if (field.type === 'boolean-radio') {
      const value = data[field.key];
      const radioValue =
        value === null ? '' : value === true ? 'yes' : 'no';

      return (
        <RadioGroup
          value={radioValue}
          onValueChange={(nextValue) =>
            setField(field.key, (nextValue === 'yes') as never)
          }
          className="grid gap-2 pt-1 sm:grid-cols-2"
        >
          {[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ].map((option) => (
            <div key={option.value} className="flex min-h-9 items-center gap-2">
              <RadioGroupItem value={option.value} id={`${fieldId}-${option.value}`} />
              <Label
                htmlFor={`${fieldId}-${option.value}`}
                className="cursor-pointer text-sm font-normal leading-snug"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );
    }

    if (field.type === 'sales-process-docs') {
      const docs = buildSalesProcessDocRows(data.salesProcessDocs);

      return (
        <div className="grid gap-3">
          {docs.map((doc, index) => (
            <div key={SALES_PROCESS_DOC_LABELS[index]} className="grid gap-2 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <Input
                aria-label={`${field.label} label ${index + 1}`}
                value={doc.label}
                onChange={(event) =>
                  updateSalesProcessDoc(index, 'label', event.target.value)
                }
                placeholder={SALES_PROCESS_DOC_LABELS[index]}
              />
              <Input
                aria-label={`${field.label} URL ${index + 1}`}
                value={doc.url}
                onChange={(event) =>
                  updateSalesProcessDoc(index, 'url', event.target.value)
                }
                placeholder="https://docs.google.com/..."
                className={cn(error && 'border-destructive')}
              />
            </div>
          ))}
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <Textarea
          id={fieldId}
          aria-label={field.label}
          value={(data[field.key] as string) ?? ''}
          onChange={(event) => setField(field.key, event.target.value as never)}
          placeholder={field.placeholder}
          rows={3}
          className={cn(error && 'border-destructive')}
        />
      );
    }

    return (
      <Input
        id={fieldId}
        aria-label={field.label}
        value={(data[field.key] as string) ?? ''}
        onChange={(event) => setField(field.key, event.target.value as never)}
        placeholder={field.placeholder}
        className={cn(error && 'border-destructive')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 pb-28">
        <header className="space-y-3 border-b border-[var(--border-subtle)] pb-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            GTM Brief Review
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-[0]">Confirm every field</h1>
              <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
                Review the AI-filled GTM Brief before the audit is frozen and
                handed to the six positioning Sections.
              </p>
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              {review.fieldCount} fields
            </div>
          </div>
        </header>

        <section
          data-testid="onboarding-review-pinned"
          className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
        >
          <div className="flex flex-col gap-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Review first
            </div>
            <p className="text-sm text-muted-foreground">
              Missing and low-confidence fields are pinned here; every field
              still remains editable in its original section below.
            </p>
          </div>
          {pinnedReviews.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No missing or low-confidence fields.
            </p>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {pinnedReviews.map((field) => (
                <a
                  key={field.key}
                  href={`#${field.key}`}
                  className="flex min-h-16 items-start justify-between gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-left hover:border-[var(--border-hover)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {pinnedLabel(field)}
                    </span>
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                      {field.sectionTitle}
                    </span>
                  </span>
                  <FieldStateBadge state={field.state} />
                </a>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-6">
          {SECTION_META.map((section) => (
            <section
              key={section.id}
              data-testid={`onboarding-section-${section.id}`}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
            >
              <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-[0]">{section.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
              </div>
              <div className="grid gap-3">
                {section.fields.map((field) => renderField(field))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="hidden font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground sm:block">
            {review.counts.Missing} missing · {review.counts['Needs review']} needs review
          </div>
          <Button type="button" onClick={handleSubmit} className="ml-auto min-w-32">
            Run audit
          </Button>
        </div>
      </div>
    </div>
  );
}
