"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Check,
  Package,
  Route,
  Sparkles,
  Target,
  TrendingUp,
  UploadCloud,
  Users,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GradientBorder } from "@/components/ui/gradient-border";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { fadeUp, easings } from "@/lib/motion";
import { buildOnboardingReviewMetadata } from "@/lib/research-v2/onboarding-review";
import {
  EMPTY_ONBOARDING_V2,
  OnboardingV2Schema,
  SECTION_META,
  SECTION_SCHEMAS,
  type OnboardingFieldReview,
  type OnboardingFieldReviewState,
  type OnboardingPrefillMetadata,
  type OnboardingReviewMetadata,
  type OnboardingV2Data,
  type SalesProcessDocRef,
  type SectionField,
  type SectionIconName,
} from "@/lib/research-v2/onboarding-v2-types";
import { cn } from "@/lib/utils";

import { AutoFillPanel } from "./auto-fill-panel";
import { DocumentUploadPanel } from "./document-upload-panel";

interface OnboardingWizardProps {
  initialData?: Partial<OnboardingV2Data>;
  initialPrefillMetadata?: OnboardingPrefillMetadata;
  initialStep?: number;
  onComplete: (
    data: OnboardingV2Data,
    reviewMetadata: OnboardingReviewMetadata,
  ) => void;
  onStepChange?: (step: number, data: Partial<OnboardingV2Data>) => void;
}

const STATE_CLASS: Record<OnboardingFieldReviewState, string> = {
  "AI-filled": "border-[var(--accent-green)] text-[color:var(--accent-green)]",
  "User-edited": "border-[var(--accent-blue)] text-[color:var(--accent-blue)]",
  Missing: "border-[var(--accent-red)] text-[color:var(--accent-red)]",
  "Needs review": "border-[var(--accent-amber)] text-[color:var(--accent-amber)]",
  // Blank optional field — calm/neutral, never red.
  Optional: "border-[var(--border-default)] text-[color:var(--text-tertiary)]",
};

const ICONS: Record<SectionIconName, ReactNode> = {
  Building2: <Building2 className="h-4 w-4" />,
  Users: <Users className="h-4 w-4" />,
  Package: <Package className="h-4 w-4" />,
  TrendingUp: <TrendingUp className="h-4 w-4" />,
  Sparkles: <Sparkles className="h-4 w-4" />,
  Target: <Target className="h-4 w-4" />,
  Route: <Route className="h-4 w-4" />,
  UploadCloud: <UploadCloud className="h-4 w-4" />,
};

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

function pinnedLabel(review: OnboardingFieldReview): string {
  if (review.key === "idealCustomer") return "Ideal Customer";
  return review.label;
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

function FieldStateBadge({
  state,
}: {
  state: OnboardingFieldReviewState;
}): ReactElement {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full border px-2 font-mono text-[10px] uppercase tracking-[0.06em]",
        STATE_CLASS[state],
      )}
    >
      {state}
    </span>
  );
}

export function OnboardingWizard({
  initialData,
  initialPrefillMetadata = {},
  initialStep,
  onComplete,
  onStepChange,
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
  const isUserAction = useRef(false);
  const pendingStepChange = useRef<{
    step: number;
    data: OnboardingV2Data;
  } | null>(null);

  const progress = ((currentStep + 1) / SECTION_META.length) * 100;

  const review = useMemo(
    () => buildOnboardingReviewMetadata(data, initialPrefillMetadata),
    [data, initialPrefillMetadata],
  );

  const pinnedReviews = review.pinnedFieldKeys
    .map((key) => review.fields[key])
    .filter((field): field is OnboardingFieldReview => Boolean(field));

  const optionalReviews = review.optionalIncomplete
    .map((key) => review.fields[key])
    .filter((field): field is OnboardingFieldReview => Boolean(field));

  useEffect(() => {
    if (pendingStepChange.current && isUserAction.current) {
      const pending = pendingStepChange.current;
      onStepChange?.(pending.step, pending.data);
      pendingStepChange.current = null;
    }
  }, [data, onStepChange]);

  function updateData(nextData: OnboardingV2Data): void {
    isUserAction.current = true;
    pendingStepChange.current = { step: currentStep, data: nextData };
    setData(nextData);
  }

  function setField<K extends keyof OnboardingV2Data>(
    key: K,
    value: OnboardingV2Data[K],
  ): void {
    setData((prev) => {
      const next = { ...prev, [key]: value };
      isUserAction.current = true;
      pendingStepChange.current = { step: currentStep, data: next };
      return next;
    });
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function applyPrefill(prefilled: Partial<OnboardingV2Data>): void {
    setData((prev) => {
      const next = mergePrefillData(prev, prefilled);
      isUserAction.current = true;
      pendingStepChange.current = { step: currentStep, data: next };
      return next;
    });
  }

  function clearAllFields(): void {
    const next = { ...EMPTY_ONBOARDING_V2 };
    setCompletedSteps(new Set());
    setHighestStepReached(0);
    setCurrentStep(0);
    updateData(next);
    setErrors({});
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

  function goToStep(stepIndex: number): void {
    if (stepIndex <= highestStepReached) {
      setCurrentStep(stepIndex);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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
    const reviewField = review.fields[field.key];
    const state = reviewField?.state ?? "Missing";
    const error = errors[field.key as string];
    const fieldId = field.key as string;
    // The wrapper keeps `id={fieldId}` as the rail scroll anchor (rail links to
    // `#${field.key}`). The control gets a distinct id so a single <label
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

    return (
      <div
        id={fieldId}
        key={fieldId}
        data-testid={`onboarding-field-${fieldId}`}
        className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
            <FieldStateBadge state={state} />
          </div>
          {renderFieldControl(field, { controlId, labelId })}
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

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <div className="space-y-8">
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

        <section
          data-testid="onboarding-review-pinned"
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4"
        >
          <div className="flex flex-col gap-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              Review first
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Required fields that are blank or low-confidence are pinned here;
              every field remains editable in its section.
            </p>
          </div>
          {pinnedReviews.length === 0 ? (
            <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              No required fields need attention.
            </p>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {pinnedReviews.map((field) => (
                <a
                  key={field.key}
                  href={`#${field.key}`}
                  className="flex min-h-16 items-start justify-between gap-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-left transition-colors hover:border-[var(--border-hover)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {pinnedLabel(field)}
                    </span>
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                      {field.sectionTitle}
                    </span>
                  </span>
                  <FieldStateBadge state={field.state} />
                </a>
              ))}
            </div>
          )}
        </section>

        {optionalReviews.length > 0 ? (
          <section
            data-testid="onboarding-review-optional"
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex flex-col gap-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                Improve output
              </div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Optional fields sharpen the audit but are not required to run it.
              </p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {optionalReviews.map((field) => (
                <a
                  key={field.key}
                  href={`#${field.key}`}
                  className="flex min-h-16 items-start justify-between gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-left transition-colors hover:border-[var(--border-hover)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {pinnedLabel(field)}
                    </span>
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                      {field.sectionTitle}
                    </span>
                  </span>
                  <FieldStateBadge state={field.state} />
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[14px]">
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                Step {currentStep + 1} of {SECTION_META.length}
              </span>
              <span style={{ color: "rgb(100, 105, 115)" }}>
                {Math.round(progress)}% complete
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full"
              style={{ background: "var(--bg-hover)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background:
                    "linear-gradient(135deg, rgb(54, 94, 255) 0%, rgb(0, 111, 255) 100%)",
                }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: easings.out }}
              />
            </div>
          </div>

          <div className="hidden md:block">
            <div className="flex justify-between">
              {SECTION_META.map((step, index) => {
                const isCurrent = index === currentStep;
                const isClickable = index <= highestStepReached;
                const isFuture = !isClickable;
                const isCompleted = completedSteps.has(index);
                const isCurrentNew = isCurrent && currentStep === highestStepReached;
                const isCurrentRevisiting = isCurrent && currentStep < highestStepReached;
                const showCheckmark = isCompleted && !isCurrent;
                const isVisitedAhead =
                  !isCurrent && index > currentStep && index <= highestStepReached;
                const isCompletedBehind = isCompleted && !isCurrent && index < currentStep;

                return (
                  <div
                    key={step.id}
                    className={cn("flex flex-col items-center gap-2", index !== 0 && "flex-1")}
                  >
                    {index !== 0 ? (
                      <div className="absolute left-0 right-0 top-4 -z-10 hidden md:block">
                        <div
                          className="h-0.5 w-full transition-colors duration-300"
                          style={{
                            background:
                              isCompletedBehind || isVisitedAhead || isCompleted
                                ? "rgb(54, 94, 255)"
                                : "rgb(31, 31, 31)",
                          }}
                        />
                      </div>
                    ) : null}

                    <motion.button
                      type="button"
                      onClick={() => {
                        if (isClickable) goToStep(index);
                      }}
                      disabled={!isClickable}
                      aria-label={isCurrent ? `Current step: ${step.title}` : `Go to ${step.title}`}
                      aria-current={isCurrent ? "step" : undefined}
                      className={cn(
                        "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2",
                        "transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(54,94,255)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(7,9,14)]",
                        isClickable && "cursor-pointer hover:opacity-80",
                        isFuture && "cursor-not-allowed",
                      )}
                      style={{
                        borderColor: isCurrentNew
                          ? "rgb(205, 208, 213)"
                          : isCurrentRevisiting || showCheckmark || isVisitedAhead
                            ? "rgb(54, 94, 255)"
                            : "rgb(31, 31, 31)",
                        background: isCurrentNew
                          ? "rgb(205, 208, 213)"
                          : showCheckmark
                            ? "rgb(54, 94, 255)"
                            : isCurrentRevisiting || isVisitedAhead
                              ? "rgba(54, 94, 255, 0.15)"
                              : "rgb(20, 23, 30)",
                        color: isCurrentNew
                          ? "rgb(20, 23, 30)"
                          : isCurrentRevisiting || isVisitedAhead
                            ? "rgb(54, 94, 255)"
                            : showCheckmark
                              ? "#ffffff"
                              : "rgb(100, 105, 115)",
                        boxShadow: isCurrentNew
                          ? "0 0 0 3px rgba(205, 208, 213, 0.2)"
                          : isCurrentRevisiting || isVisitedAhead
                            ? "0 0 8px rgba(54, 94, 255, 0.4)"
                            : undefined,
                      }}
                      animate={isCurrent ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                      transition={
                        isCurrent
                          ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                          : { duration: 0.3 }
                      }
                      whileHover={isClickable ? { scale: 1.1 } : undefined}
                      whileTap={isClickable ? { scale: 0.95 } : undefined}
                    >
                      {showCheckmark ? <Check className="h-4 w-4" /> : ICONS[step.icon]}
                    </motion.button>

                    <span
                      className={cn(
                        "text-xs transition-all duration-200",
                        isCurrent ? "font-bold" : "font-medium",
                        isClickable && "cursor-pointer hover:text-[rgb(252,252,250)]",
                        isFuture && "cursor-not-allowed",
                      )}
                      style={{
                        color: isCurrentNew
                          ? "rgb(252, 252, 250)"
                          : isCurrentRevisiting || isVisitedAhead
                            ? "rgb(54, 94, 255)"
                            : showCheckmark
                              ? "rgb(205, 208, 213)"
                              : "rgb(100, 105, 115)",
                        textShadow: isCurrentNew
                          ? "0 0 8px rgba(205, 208, 213, 0.5)"
                          : undefined,
                      }}
                    >
                      {step.shortTitle ?? step.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full border-2"
                style={{
                  background: "rgb(205, 208, 213)",
                  borderColor: "rgb(205, 208, 213)",
                  color: "rgb(20, 23, 30)",
                }}
              >
                {ICONS[currentSection.icon]}
              </div>
              <div>
                <p className="text-[16px] font-bold" style={{ color: "rgb(252, 252, 250)" }}>
                  {currentSection.title}
                </p>
                <p className="text-[14px]" style={{ color: "rgb(100, 105, 115)" }}>
                  Step {currentStep + 1} of {SECTION_META.length}
                </p>
              </div>
            </div>

            <div className="relative -mx-4 px-4">
              <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {SECTION_META.map((step, index) => {
                  const isCurrent = index === currentStep;
                  const isClickable = index <= highestStepReached;
                  const isCompleted = completedSteps.has(index);

                  return (
                    <motion.button
                      key={step.id}
                      type="button"
                      onClick={() => {
                        if (isClickable) goToStep(index);
                      }}
                      disabled={!isClickable}
                      aria-current={isCurrent ? "step" : undefined}
                      className={cn(
                        "flex min-h-[36px] flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3 py-2 text-xs",
                        "transition-all duration-200",
                        isCurrent ? "font-bold" : "font-medium",
                        !isClickable && "cursor-not-allowed opacity-50",
                      )}
                      style={{
                        borderColor: isCurrent || isCompleted
                          ? "rgb(54, 94, 255)"
                          : "var(--border-default)",
                        background: isCurrent || isCompleted
                          ? "rgba(54, 94, 255, 0.15)"
                          : "var(--bg-hover)",
                        color: isCurrent || isCompleted
                          ? "rgb(54, 94, 255)"
                          : "var(--text-tertiary)",
                      }}
                      whileTap={isClickable ? { scale: 0.95 } : undefined}
                    >
                      {isCompleted && !isCurrent ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <span className="flex h-3 w-3 items-center justify-center">
                          {index + 1}
                        </span>
                      )}
                      <span>{step.shortTitle ?? step.title}</span>
                    </motion.button>
                  );
                })}
              </div>
              <div
                className="pointer-events-none absolute bottom-2 right-4 top-0 w-8"
                style={{
                  background:
                    "linear-gradient(to right, transparent, var(--bg-elevated))",
                }}
              />
            </div>
          </div>
        </div>

        <GradientBorder className="overflow-hidden">
          <motion.div
            key={currentSection.id}
            className="p-6 md:p-8"
            style={{ background: "var(--bg-elevated)" }}
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.6, ease: easings.out }}
          >
            <section
              data-testid={`onboarding-section-${currentSection.id}`}
              className="space-y-5"
            >
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {currentSection.shortTitle ?? currentSection.title}
                </div>
                <h2 className="mt-2 text-xl font-semibold tracking-[0]">
                  {currentSection.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentSection.description}
                </p>
              </div>

              {currentStep === 0 ? (
                <div className="grid gap-3">
                  <AutoFillPanel onPrefillComplete={applyPrefill} />
                  <DocumentUploadPanel onPrefillComplete={applyPrefill} />
                </div>
              ) : null}

              <div className="grid gap-3">
                {currentSection.fields.map((field) => renderField(field))}
              </div>

              {Object.keys(errors).length > 0 ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    Fix the highlighted fields before continuing.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={goToPreviousStep}
                  disabled={currentStep === 0}
                  className="h-10 rounded-md px-4 py-2 text-sm font-medium"
                >
                  Back
                </Button>
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
                    onClick={goToNextStep}
                    className="h-10 rounded-md px-4 py-2 text-sm font-semibold text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, rgb(54, 94, 255) 0%, rgb(0, 111, 255) 100%)",
                    }}
                  >
                    {isLastStep ? "Run audit" : "Continue"}
                  </Button>
                </div>
              </div>
            </section>
          </motion.div>
        </GradientBorder>
      </div>
    </div>
  );
}
