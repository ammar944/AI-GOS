"use client";

import { useMemo, useState, type ReactElement } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { buildOnboardingReviewMetadata } from "@/lib/research-v2/onboarding-review";
import {
  EMPTY_ONBOARDING_V2,
  OnboardingV2Schema,
  SECTION_META,
  type OnboardingPrefillMetadata,
  type OnboardingReviewMetadata,
  type OnboardingV2Data,
  type SalesProcessDocRef,
  type SectionField,
} from "@/lib/research-v2/onboarding-v2-types";
import { cn } from "@/lib/utils";

import { AutoFillPanel } from "./auto-fill-panel";
import { DocumentUploadPanel } from "./document-upload-panel";

interface OnboardingWizardProps {
  initialData?: Partial<OnboardingV2Data>;
  initialPrefillMetadata?: OnboardingPrefillMetadata;
  onComplete: (
    data: OnboardingV2Data,
    reviewMetadata: OnboardingReviewMetadata,
  ) => void;
}

const SALES_PROCESS_DOC_LABELS = [
  "Process overview",
  "SDR outreach SOP",
  "Opt-in follow-up SOP",
  "Personalization SOP",
] as const;

function buildSalesProcessDocRows(
  docs: readonly SalesProcessDocRef[],
): SalesProcessDocRef[] {
  return SALES_PROCESS_DOC_LABELS.map((defaultLabel, index) => {
    const existing = docs[index];
    return {
      label: existing?.label ?? defaultLabel,
      url: existing?.url ?? "",
    };
  });
}

function deriveGtmMotion(
  salesMotion: OnboardingV2Data["salesMotion"],
): OnboardingV2Data["gtmMotion"] {
  if (salesMotion === "product_led") return "PLG";
  if (salesMotion === "sales_led" || salesMotion === "hybrid") return "SLG";
  return "";
}

function hasPrefillValue(value: OnboardingV2Data[keyof OnboardingV2Data]): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "boolean") {
    return true;
  }
  if (value === null) {
    return false;
  }
  return String(value).trim().length > 0;
}

function mergePrefillData(
  data: OnboardingV2Data,
  prefilled: Partial<OnboardingV2Data>,
): OnboardingV2Data {
  const next: OnboardingV2Data = { ...data };

  for (const key of Object.keys(prefilled) as Array<keyof OnboardingV2Data>) {
    const value = prefilled[key];
    if (value === undefined || !hasPrefillValue(value)) {
      continue;
    }
    next[key] = value as never;
  }

  return next;
}

function issuesToErrors(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): Record<string, string> {
  const nextErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !nextErrors[key]) {
      nextErrors[key] = issue.message;
    }
  }
  return nextErrors;
}

export function OnboardingWizard({
  initialData,
  initialPrefillMetadata = {},
  onComplete,
}: OnboardingWizardProps): ReactElement {
  const [data, setData] = useState<OnboardingV2Data>({
    ...EMPTY_ONBOARDING_V2,
    ...initialData,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const review = useMemo(
    () => buildOnboardingReviewMetadata(data, initialPrefillMetadata),
    [data, initialPrefillMetadata],
  );

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

  function applyPrefill(prefilled: Partial<OnboardingV2Data>): void {
    setData((prev) => mergePrefillData(prev, prefilled));
  }

  function clearAllFields(): void {
    setData({ ...EMPTY_ONBOARDING_V2 });
    setErrors({});
  }

  function toggleChannel(value: string): void {
    const channels = data.channels.includes(value)
      ? data.channels.filter((channel) => channel !== value)
      : [...data.channels, value];
    setField("channels", channels);
  }

  function updateSalesProcessDoc(
    index: number,
    key: keyof SalesProcessDocRef,
    value: string,
  ): void {
    const docs = buildSalesProcessDocRows(data.salesProcessDocs);
    docs[index] = { ...docs[index], [key]: value };
    setField("salesProcessDocs", docs);
  }

  function dataForSubmit(): OnboardingV2Data {
    return {
      ...data,
      gtmMotion: deriveGtmMotion(data.salesMotion),
    };
  }

  function handleSubmit(): void {
    const nextData = dataForSubmit();
    const parsed = OnboardingV2Schema.safeParse(nextData);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      return;
    }

    setErrors({});
    onComplete(
      parsed.data,
      buildOnboardingReviewMetadata(parsed.data, initialPrefillMetadata),
    );
  }

  function renderField(field: SectionField): ReactElement {
    const error = errors[field.key as string];
    const fieldId = field.key as string;
    // The wrapper keeps `id={fieldId}` as a stable anchor. The control gets a
    // distinct id so a single <label htmlFor> resolves to the control, not the
    // wrapper div. Group fields (radio/checkbox) use the label as an
    // `aria-labelledby` caption instead, since a <label> cannot label a
    // multi-control group.
    const labelId = `${fieldId}-label`;
    const controlId = `${fieldId}-control`;
    const isGroupField =
      field.type === "radio" ||
      field.type === "checkbox" ||
      field.type === "boolean-radio" ||
      field.type === "sales-process-docs";

    return (
      <div id={fieldId} key={fieldId} data-testid={`onboarding-field-${fieldId}`} className="space-y-2">
        <Label
          id={labelId}
          htmlFor={isGroupField ? undefined : controlId}
          className="text-sm font-medium leading-snug"
        >
          {field.label}
          {field.required ? (
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
          ) : (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {field.description ?? "(optional)"}
            </span>
          )}
        </Label>
        {renderFieldControl(field, { controlId, labelId })}
        {error ? (
          <Alert variant="destructive" className="px-3 py-2">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    );
  }

  function renderFieldControl(
    field: SectionField,
    ids: { controlId: string; labelId: string },
  ): ReactElement {
    const fieldId = field.key as string;
    const { controlId, labelId } = ids;
    const error = errors[fieldId];
    const requiredProps = field.required ? { "aria-required": true } : {};

    if (field.type === "radio") {
      return (
        <RadioGroup
          name={fieldId}
          aria-labelledby={labelId}
          {...requiredProps}
          value={(data[field.key] as string) ?? ""}
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

    if (field.type === "checkbox") {
      return (
        <div
          role="group"
          aria-labelledby={labelId}
          {...requiredProps}
          className="grid gap-2 pt-1 sm:grid-cols-2"
        >
          {field.options?.map((option) => (
            <div key={option.value} className="flex min-h-9 items-center gap-2">
              <Checkbox
                id={`${fieldId}-${option.value}`}
                name={fieldId}
                value={option.value}
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

    if (field.type === "boolean-radio") {
      const value = data[field.key];
      const radioValue = value === null ? "" : value === true ? "yes" : "no";

      return (
        <RadioGroup
          name={fieldId}
          aria-labelledby={labelId}
          value={radioValue}
          onValueChange={(nextValue) =>
            setField(field.key, (nextValue === "yes") as never)
          }
          className="grid gap-2 pt-1 sm:grid-cols-2"
        >
          {[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
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

    if (field.type === "sales-process-docs") {
      const docs = buildSalesProcessDocRows(data.salesProcessDocs);

      return (
        <div role="group" aria-labelledby={labelId} className="grid gap-3">
          {docs.map((doc, index) => (
            <div
              key={SALES_PROCESS_DOC_LABELS[index]}
              className="grid gap-2 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
            >
              <Input
                id={`${fieldId}-${index}-label`}
                name={`${fieldId}-${index}-label`}
                aria-label={`${field.label} label ${index + 1}`}
                value={doc.label}
                onChange={(event) =>
                  updateSalesProcessDoc(index, "label", event.target.value)
                }
                placeholder={SALES_PROCESS_DOC_LABELS[index]}
              />
              <Input
                id={`${fieldId}-${index}-url`}
                name={`${fieldId}-${index}-url`}
                aria-label={`${field.label} URL ${index + 1}`}
                value={doc.url}
                onChange={(event) =>
                  updateSalesProcessDoc(index, "url", event.target.value)
                }
                placeholder="https://docs.google.com/..."
                className={cn(error && "border-destructive")}
              />
            </div>
          ))}
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <Textarea
          id={controlId}
          name={fieldId}
          {...requiredProps}
          aria-invalid={error ? true : undefined}
          value={(data[field.key] as string) ?? ""}
          onChange={(event) => setField(field.key, event.target.value as never)}
          placeholder={field.placeholder}
          rows={3}
          className={cn(error && "border-destructive")}
        />
      );
    }

    return (
      <Input
        id={controlId}
        name={fieldId}
        {...requiredProps}
        aria-invalid={error ? true : undefined}
        value={(data[field.key] as string) ?? ""}
        onChange={(event) => setField(field.key, event.target.value as never)}
        placeholder={field.placeholder}
        className={cn(error && "border-destructive")}
      />
    );
  }

  const pinnedCount = review.pinnedFieldKeys.length;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header className="space-y-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          GTM Brief Review
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              className="text-[24px] font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Confirm every field
            </h1>
            <p
              className="mt-2 max-w-[70ch] leading-relaxed"
              style={{ color: "var(--text-secondary)", fontSize: "15px" }}
            >
              Review the corpus-filled GTM Brief before the audit is frozen and
              handed to the six positioning Sections.
            </p>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            {review.fieldCount} fields
          </div>
        </div>
      </header>

      <div className="grid gap-3">
        <AutoFillPanel onPrefillComplete={applyPrefill} />
        <DocumentUploadPanel onPrefillComplete={applyPrefill} />
      </div>

      <div className="space-y-10">
        {SECTION_META.map((section) => (
          <section
            key={section.id}
            data-testid={`onboarding-section-${section.id}`}
            className="space-y-4"
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {section.shortTitle ?? section.title}
              </div>
              <h2 className="mt-2 text-xl font-semibold tracking-[0]">
                {section.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {section.description}
              </p>
            </div>
            <div className="grid gap-4">
              {section.fields.map((field) => renderField(field))}
            </div>
          </section>
        ))}
      </div>

      {Object.keys(errors).length > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            Fix the highlighted fields before running the audit.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        {pinnedCount > 0 ? (
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {pinnedCount} fields still need input
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={clearAllFields}
            className="h-10 rounded-md px-4 py-2 text-sm font-medium"
          >
            Clear
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            className="h-10 rounded-md px-4 py-2 text-sm font-semibold text-white"
            style={{
              background:
                "linear-gradient(135deg, rgb(54, 94, 255) 0%, rgb(0, 111, 255) 100%)",
            }}
          >
            Run audit
          </Button>
        </div>
      </div>
    </div>
  );
}
