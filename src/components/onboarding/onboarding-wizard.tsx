"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from "react";
import { ArrowRight, Check, ChevronDown, ExternalLink } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { isNonAnswer } from "@/lib/research-v2/non-answer";
import { buildOnboardingReviewMetadata } from "@/lib/research-v2/onboarding-review";
import {
  EMPTY_ONBOARDING_V2,
  OnboardingV2Schema,
  SECTION_META,
  SECTION_SCHEMAS,
  type OnboardingFieldReview,
  type OnboardingPrefillMetadata,
  type OnboardingReviewMetadata,
  type OnboardingV2Data,
  type SalesProcessDocRef,
  type SectionField,
} from "@/lib/research-v2/onboarding-v2-types";
import type { CorpusSourceLink } from "@/lib/research-v2/state-machine";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
  initialData?: Partial<OnboardingV2Data>;
  initialPrefillMetadata?: OnboardingPrefillMetadata;
  /**
   * Cited sources captured by the corpus run, surfaced read-only in a
   * persistent "Researched N sources" disclosure. Optional so the wizard
   * still mounts when no corpus sources were threaded through.
   */
  corpusSources?: CorpusSourceLink[];
  /**
   * Test-only seam: which section index to mount first. Defaults to 0 so
   * production callers never need to pass it.
   */
  initialStep?: number;
  onComplete: (
    data: OnboardingV2Data,
    reviewMetadata: OnboardingReviewMetadata,
  ) => void;
}

// Single accent (DESIGN.md: one accent blue, no decorative gradients).
const ACCENT = "rgb(54, 94, 255)";

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

// Confidence band → DESIGN.md status colors. Mirrors the prefill-summary
// pattern (high/med/low) but keyed off the 0–1 normalized confidence stored
// in OnboardingFieldReview.
function confidenceBand(
  confidence: number,
): { label: string; color: string; bg: string } {
  if (confidence >= 0.9)
    return { label: "High", color: "rgb(34, 197, 94)", bg: "rgba(34, 197, 94, 0.15)" };
  if (confidence >= 0.5)
    return { label: "Medium", color: "rgb(234, 179, 8)", bg: "rgba(234, 179, 8, 0.15)" };
  return { label: "Low", color: "rgb(239, 68, 68)", bg: "rgba(239, 68, 68, 0.15)" };
}

function ConfidenceBadge({ confidence }: { confidence: number }): ReactElement {
  const band = confidenceBand(confidence);
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      style={{ background: band.bg, color: band.color }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: band.color }}
      />
      {band.label}
    </span>
  );
}

// Per-field AI-fill provenance: a confidence badge plus a click-through to the
// cited source URL. Renders nothing for user-typed or unsourced fields.
function FieldProvenance({
  review,
}: {
  review: OnboardingFieldReview | undefined;
}): ReactElement | null {
  if (!review) return null;
  const hasConfidence = typeof review.confidence === "number";
  const hasSource = Boolean(review.sourceUrl?.trim());
  if (!hasConfidence && !hasSource) return null;

  return (
    <span className="inline-flex items-center gap-1.5">
      {hasConfidence ? (
        <ConfidenceBadge confidence={review.confidence as number} />
      ) : null}
      {hasSource ? (
        <a
          href={review.sourceUrl as string}
          target="_blank"
          rel="noopener noreferrer"
          title={review.sourceUrl as string}
          className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] underline-offset-2 transition-colors hover:text-[var(--text-secondary)] hover:underline"
        >
          Source
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      ) : null}
    </span>
  );
}

// Persistent "Researched N sources" disclosure. Surfaces the corpus's cited
// sources read-only so the operator can audit provenance. Mirrors the
// prefill-summary ExternalLink pattern; honors the industrial DESIGN.md tokens.
function CorpusSourcesDisclosure({
  sources,
}: {
  sources: CorpusSourceLink[];
}): ReactElement | null {
  const [open, setOpen] = useState(false);
  if (sources.length === 0) return null;

  return (
    <div
      data-testid="corpus-sources-disclosure"
      className="overflow-hidden rounded-[6px] border"
      style={{
        borderColor: "var(--border-subtle)",
        background: "var(--bg-surface)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
      >
        <span
          className="font-mono text-[10px] uppercase tracking-[0.08em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Researched {sources.length}{" "}
          {sources.length === 1 ? "source" : "sources"}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-150",
            open && "rotate-180",
          )}
          style={{ color: "var(--text-tertiary)" }}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <ul
          className="space-y-0.5 border-t px-2 py-2"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {sources.map((source, index) => (
            <li key={`${source.url}-${index}`}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                title={source.url}
                className="flex items-start gap-2 rounded-[5px] px-2 py-1.5 transition-colors hover:bg-[var(--bg-hover)]"
              >
                <span
                  className="mt-0.5 font-mono text-[10px] tabular-nums"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[13px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {source.title}
                  </span>
                  {source.whyItMatters ? (
                    <span
                      className="block truncate text-[11px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {source.whyItMatters}
                    </span>
                  ) : null}
                </span>
                <ExternalLink
                  className="mt-0.5 h-3 w-3 shrink-0"
                  style={{ color: "var(--text-tertiary)" }}
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// "$[Budget]"-style template garbage (brackets required so real budgets and
// honest prose never match). Mirrors the commit-path scrub in
// src/lib/lab-engine/artifacts/schemas/paid-media-plan.ts.
const BUDGET_PLACEHOLDER_PATTERN = /\$?\s*[[{]\s*budget\s*[\]}]/i;

// Non-blocking guidance for the monthlyAdBudget field: a non-answer ("idk") or
// placeholder garbage passes the required-field check but starves the paid
// media plan's spend math (a live run shipped the literal "$[Budget] / Month").
// Honest-gap idiom — warn about the consequence, never hard-block submission.
function budgetGuidance(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null; // blank is the required-field error's job
  if (!isNonAnswer(trimmed) && !BUDGET_PLACEHOLDER_PATTERN.test(trimmed)) {
    return null;
  }
  return (
    "The media plan computes daily spend and phase budgets from this number. " +
    "Without a real monthly budget, the plan ships with “Budget not provided” instead of spend math."
  );
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

/** Locate the section index + field metadata for a given field key. */
function locateField(
  key: keyof OnboardingV2Data,
): { stepIndex: number; field: SectionField } | null {
  for (let stepIndex = 0; stepIndex < SECTION_META.length; stepIndex += 1) {
    const field = SECTION_META[stepIndex]!.fields.find((f) => f.key === key);
    if (field) {
      return { stepIndex, field };
    }
  }
  return null;
}

export function OnboardingWizard({
  initialData,
  initialPrefillMetadata = {},
  corpusSources,
  initialStep,
  onComplete,
}: OnboardingWizardProps): ReactElement {
  const startStep = initialStep ?? 0;
  const [currentStep, setCurrentStep] = useState(startStep);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => {
    const steps = new Set<number>();
    for (let index = 0; index < startStep; index += 1) {
      steps.add(index);
    }
    return steps;
  });
  const [highestStepReached, setHighestStepReached] = useState(startStep);
  const [data, setData] = useState<OnboardingV2Data>({
    ...EMPTY_ONBOARDING_V2,
    ...initialData,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Field key to scroll-to + focus after a cross-step jump mounts its section.
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  const progress = ((currentStep + 1) / SECTION_META.length) * 100;

  const review = useMemo(
    () => buildOnboardingReviewMetadata(data, initialPrefillMetadata),
    [data, initialPrefillMetadata],
  );

  // After a jump switches steps, scroll the target field into view and focus
  // its control. The effect runs after React commits the new section to the
  // DOM (currentStep is in the deps), so the target element exists.
  useEffect(() => {
    if (!pendingFocus) return;
    const target = pendingFocus;
    const anchor = document.getElementById(target);
    // jsdom does not implement scrollIntoView — guard so focus still runs.
    if (anchor && typeof anchor.scrollIntoView === "function") {
      anchor.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const control = document.getElementById(`${target}-control`);
    if (control instanceof HTMLElement) {
      control.focus();
    }
    setPendingFocus(null);
  }, [pendingFocus, currentStep]);

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

  function clearAllFields(): void {
    setData({ ...EMPTY_ONBOARDING_V2 });
    setErrors({});
    setCompletedSteps(new Set());
    setHighestStepReached(0);
    setCurrentStep(0);
  }

  function validateStep(stepIndex: number): boolean {
    const schema = SECTION_SCHEMAS[stepIndex];
    if (!schema) return true;

    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      return false;
    }

    setErrors({});
    return true;
  }

  function goToNextStep(): void {
    if (!validateStep(currentStep)) return;

    if (currentStep < SECTION_META.length - 1) {
      setCompletedSteps((prev) => new Set(prev).add(currentStep));
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setHighestStepReached((prev) => Math.max(prev, nextStep));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    handleSubmit();
  }

  function goToPreviousStep(): void {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Stepper-click navigation: only steps already reached are clickable.
  function goToStep(stepIndex: number): void {
    if (stepIndex <= highestStepReached) {
      setCurrentStep(stepIndex);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Jump-to-required-field: bypasses the `<= highestStepReached` guard so the
  // affordance can reach ANY step, including forward, not-yet-visited ones.
  function jumpToField(key: keyof OnboardingV2Data): void {
    const located = locateField(key);
    if (!located) return;
    const { stepIndex } = located;
    setCurrentStep(stepIndex);
    setHighestStepReached((prev) => Math.max(prev, stepIndex));
    setPendingFocus(key as string);
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
    // The wrapper keeps `id={fieldId}` as a stable anchor (jump-to-field scrolls
    // to `#${field.key}`). The control gets a distinct id so a single <label
    // htmlFor> resolves to the control, not the wrapper div. Group fields
    // (radio/checkbox) use the label as an `aria-labelledby` caption instead,
    // since a <label> cannot label a multi-control group.
    const labelId = `${fieldId}-label`;
    const controlId = `${fieldId}-control`;
    const isGroupField =
      field.type === "radio" ||
      field.type === "checkbox" ||
      field.type === "boolean-radio" ||
      field.type === "sales-process-docs";

    const fieldReview = review.fields[field.key];
    const guidance =
      field.key === "monthlyAdBudget"
        ? budgetGuidance(data.monthlyAdBudget)
        : null;

    return (
      <div
        id={fieldId}
        key={fieldId}
        data-testid={`onboarding-field-${fieldId}`}
        className="space-y-2"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
          <FieldProvenance review={fieldReview} />
        </div>
        {renderFieldControl(field, { controlId, labelId })}
        {error ? (
          <Alert variant="destructive" className="px-3 py-2">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        ) : null}
        {guidance ? (
          <p
            data-testid="onboarding-budget-guidance"
            className="text-xs leading-relaxed"
            style={{ color: "rgb(234, 179, 8)" }}
          >
            {guidance}
          </p>
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

  const currentSection = SECTION_META[currentStep]!;
  const isLastStep = currentStep === SECTION_META.length - 1;

  const pinnedCount = review.pinnedFieldKeys.length;
  const nextRequiredKey = review.pinnedFieldKeys[0];
  const nextRequiredLabel = nextRequiredKey
    ? (locateField(nextRequiredKey)?.field.label ?? null)
    : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            GTM Brief Review
          </div>
          <h1
            className="text-[19px] font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Confirm every field
          </h1>
          <p
            className="text-[13px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Review the corpus-filled brief before the audit is frozen and handed
            to the six positioning Sections.
          </p>
        </div>
        <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          {review.fieldCount} fields
        </div>
      </header>

      {corpusSources && corpusSources.length > 0 ? (
        <CorpusSourcesDisclosure sources={corpusSources} />
      ) : null}

      {/* Progress + step rail */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
            Step {currentStep + 1} of {SECTION_META.length}
          </span>
          <span
            className="font-mono tabular-nums"
            style={{ color: "var(--text-tertiary)" }}
          >
            {Math.round(progress)}%
          </span>
        </div>
        <div
          className="h-[3px] overflow-hidden rounded-full"
          style={{ background: "var(--bg-hover)" }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%`, background: ACCENT }}
          />
        </div>

        {/* Single step rail — sits flush on desktop, scrolls on narrow screens. */}
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div
            className="flex min-w-max items-stretch gap-0.5 border-b"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {SECTION_META.map((step, index) => {
              const isCurrent = index === currentStep;
              const isClickable = index <= highestStepReached;
              const isCompleted = completedSteps.has(index);
              const isActiveTone = isCurrent || isCompleted;
              const showCheckmark = isCompleted && !isCurrent;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    if (isClickable) goToStep(index);
                  }}
                  disabled={!isClickable}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={
                    isCurrent
                      ? `Current step: ${step.title}`
                      : `Go to ${step.title}`
                  }
                  className={cn(
                    "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-[1.5px] px-2.5 py-2 text-[12px]",
                    "transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(54,94,255)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-base)]",
                    isClickable ? "cursor-pointer" : "cursor-not-allowed",
                    isCurrent ? "font-semibold" : "font-medium",
                  )}
                  style={{
                    borderColor: isCurrent ? ACCENT : "transparent",
                    color: isCurrent
                      ? "var(--text-primary)"
                      : isActiveTone
                        ? "var(--text-secondary)"
                        : "var(--text-tertiary)",
                  }}
                >
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono text-[9px] tabular-nums"
                    style={{
                      background: showCheckmark ? ACCENT : "transparent",
                      border: showCheckmark
                        ? "none"
                        : `1px solid ${isCurrent ? ACCENT : "var(--border-default)"}`,
                      color: showCheckmark
                        ? "#ffffff"
                        : isCurrent
                          ? ACCENT
                          : "var(--text-tertiary)",
                    }}
                  >
                    {showCheckmark ? <Check className="h-2.5 w-2.5" /> : index + 1}
                  </span>
                  {step.shortTitle ?? step.title}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Current step */}
      <div
        className="overflow-hidden rounded-[8px] border"
        style={{
          borderColor: "var(--border-default)",
          background: "var(--bg-elevated)",
        }}
      >
        <section
          key={currentSection.id}
          data-testid={`onboarding-section-${currentSection.id}`}
          className="space-y-5 p-5 md:p-6"
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {currentSection.shortTitle ?? currentSection.title}
            </div>
            <h2 className="mt-1.5 text-[16px] font-semibold tracking-tight">
              {currentSection.title}
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {currentSection.description}
            </p>
          </div>

          <div className="grid gap-4">
            {currentSection.fields.map((field) => renderField(field))}
          </div>

          {Object.keys(errors).length > 0 ? (
            <Alert variant="destructive">
              <AlertDescription>
                Fix the highlighted fields before continuing.
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Still-required panel: jump to the first incomplete required field. */}
          <div
            data-testid="onboarding-still-required"
            className="flex flex-col gap-3 rounded-[6px] border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            style={{
              borderColor: "var(--border-subtle)",
              background: "var(--bg-surface)",
            }}
          >
            {pinnedCount > 0 ? (
              <>
                <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  {pinnedCount} {pinnedCount === 1 ? "field" : "fields"} still
                  need input
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (nextRequiredKey) jumpToField(nextRequiredKey);
                  }}
                  className="h-8 shrink-0 rounded-[5px] px-3 text-[13px] font-medium"
                >
                  Go to next field
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {nextRequiredLabel ? (
                    <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
                      Next: &ldquo;{nextRequiredLabel}&rdquo;
                    </span>
                  ) : null}
                </Button>
              </>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 text-[13px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                <Check className="h-3.5 w-3.5 text-[color:var(--accent-green)]" />
                All required fields complete
              </span>
            )}
          </div>

          {/* Footer: Back / Clear / Continue */}
          <div
            className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <Button
              type="button"
              variant="outline"
              onClick={goToPreviousStep}
              disabled={currentStep === 0}
              className="h-9 rounded-[5px] px-4 text-[13px] font-medium"
            >
              Back
            </Button>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={clearAllFields}
                className="h-9 rounded-[5px] px-3 text-[13px] font-medium"
              >
                Clear
              </Button>
              <Button
                type="button"
                onClick={goToNextStep}
                className="h-9 rounded-[5px] px-4 text-[13px] font-semibold text-white transition-colors hover:opacity-90"
                style={{ background: ACCENT }}
              >
                {isLastStep ? "Run audit" : "Continue"}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
