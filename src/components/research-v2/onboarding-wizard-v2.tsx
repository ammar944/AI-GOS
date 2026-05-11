'use client';

import { useState } from 'react';
import {
  Building2, Users, Package, TrendingUp, Sparkles, Target, Route, Check,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

import {
  SECTION_META,
  SECTION_SCHEMAS,
  EMPTY_ONBOARDING_V2,
  type OnboardingV2Data,
  type SectionIconName,
} from '@/lib/research-v2/onboarding-v2-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OnboardingWizardV2Props {
  initialData?: Partial<OnboardingV2Data>;
  onComplete: (data: OnboardingV2Data) => void;
}

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const ICON_MAP: Record<SectionIconName, LucideIcon> = {
  Building2, Users, Package, TrendingUp, Sparkles, Target, Route,
};

// ---------------------------------------------------------------------------
// Completion helper
// ---------------------------------------------------------------------------

function isSectionComplete(
  sectionId: string,
  data: Partial<OnboardingV2Data>,
): boolean {
  const section = SECTION_META.find((s) => s.id === sectionId);
  if (!section) return false;
  return section.fields
    .filter((f) => f.required)
    .every((f) => {
      const value = data[f.key];
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== '';
    });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OnboardingWizardV2({ initialData, onComplete }: OnboardingWizardV2Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingV2Data>({
    ...EMPTY_ONBOARDING_V2,
    ...initialData,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalSteps = SECTION_META.length;
  const section = SECTION_META[step];
  const completedCount = SECTION_META.reduce((n, s) => n + (isSectionComplete(s.id, data) ? 1 : 0), 0);

  // -------------------------------------------------------------------------
  // Field update helpers
  // -------------------------------------------------------------------------

  function setField<K extends keyof OnboardingV2Data>(key: K, value: OnboardingV2Data[K]) {
    setData(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
    }
  }

  function toggleChannel(value: string) {
    setData(prev => {
      const channels = prev.channels.includes(value)
        ? prev.channels.filter(c => c !== value)
        : [...prev.channels, value];
      return { ...prev, channels };
    });
    if (errors.channels) {
      setErrors(prev => { const next = { ...prev }; delete next.channels; return next; });
    }
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  function validateStep(): boolean {
    const schema = SECTION_SCHEMAS[step];
    if (!schema) return true;

    const partial: Record<string, unknown> = {};
    for (const field of section.fields) {
      partial[field.key] = data[field.key];
    }

    const result = schema.safeParse(partial);
    if (result.success) {
      setErrors({});
      return true;
    }

    const newErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      if (key && !newErrors[key]) {
        newErrors[key] = issue.message;
      }
    }
    setErrors(newErrors);
    return false;
  }

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  function handleNext() {
    if (!validateStep()) return;
    if (step < totalSteps - 1) {
      setStep(s => s + 1);
      setErrors({});
    } else {
      onComplete(data);
    }
  }

  function handleBack() {
    if (step > 0) {
      setStep(s => s - 1);
      setErrors({});
    }
  }

  function handleNavJump(index: number) {
    setStep(index);
    setErrors({});
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  function renderField(field: typeof section.fields[number]) {
    const error = errors[field.key as string];

    const labelEl = (
      <Label htmlFor={field.key as string} className="text-sm font-medium leading-none">
        {field.label}
        {field.required
          ? <span className="text-destructive ml-0.5">*</span>
          : <span className="text-muted-foreground ml-1 font-normal text-xs">
              {field.description ?? '(optional)'}
            </span>
        }
      </Label>
    );

    if (field.type === 'radio') {
      return (
        <div key={field.key as string} className="space-y-2">
          {labelEl}
          <RadioGroup
            value={(data[field.key] as string) ?? ''}
            onValueChange={v => setField(field.key, v as never)}
            className="flex flex-col gap-1.5 pt-1"
          >
            {field.options?.map(opt => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupItem value={opt.value} id={`${field.key as string}-${opt.value}`} />
                <Label
                  htmlFor={`${field.key as string}-${opt.value}`}
                  className="font-normal cursor-pointer text-sm"
                >
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {error && (
            <Alert variant="destructive" className="py-2 px-3">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <div key={field.key as string} className="space-y-2">
          {labelEl}
          <div className="flex flex-wrap gap-3 pt-1">
            {field.options?.map(opt => (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox
                  id={`${field.key as string}-${opt.value}`}
                  checked={(data.channels as string[]).includes(opt.value)}
                  onCheckedChange={() => toggleChannel(opt.value)}
                />
                <Label
                  htmlFor={`${field.key as string}-${opt.value}`}
                  className="font-normal cursor-pointer text-sm"
                >
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>
          {error && (
            <Alert variant="destructive" className="py-2 px-3">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.key as string} className="space-y-1.5">
          {labelEl}
          <Textarea
            id={field.key as string}
            value={(data[field.key] as string) ?? ''}
            onChange={e => setField(field.key, e.target.value as never)}
            placeholder={field.placeholder}
            rows={3}
            className={error ? 'border-destructive' : ''}
          />
          {error && (
            <Alert variant="destructive" className="py-2 px-3">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      );
    }

    // default: text
    return (
      <div key={field.key as string} className="space-y-1.5">
        {labelEl}
        <Input
          id={field.key as string}
          value={(data[field.key] as string) ?? ''}
          onChange={e => setField(field.key, e.target.value as never)}
          placeholder={field.placeholder}
          className={error ? 'border-destructive' : ''}
        />
        {error && (
          <Alert variant="destructive" className="py-2 px-3">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col min-h-screen">
      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-28 max-w-2xl mx-auto w-full">
        {/* Section nav: segmented progress rail + 7 numbered cells.
            Three states per cell — idle | current | done. */}
        <nav aria-label="Onboarding sections" className="mb-5 select-none">
          <div className="flex items-baseline justify-between mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            <span>
              <span className="text-foreground">{String(step + 1).padStart(2, '0')}</span>
              <span className="text-muted-foreground/60"> / {String(totalSteps).padStart(2, '0')}</span>
              <span className="ml-2 text-muted-foreground/80">{section.shortTitle ?? section.title}</span>
            </span>
            <span>{completedCount} / {totalSteps} complete</span>
          </div>
          <ol className="grid grid-cols-7 gap-1" role="list">
            {SECTION_META.map((s, i) => {
              const NavIcon = ICON_MAP[s.icon];
              const isActive = i === step;
              const done = isSectionComplete(s.id, data);
              const label = s.shortTitle ?? s.title;
              return (
                <li key={s.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => handleNavJump(i)}
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={`Step ${i + 1} of ${totalSteps}: ${s.title}${done ? ' (complete)' : ''}${isActive ? ' (current)' : ''}`}
                    className={cn(
                      'group relative w-full text-left rounded-md transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      isActive ? 'bg-accent/40' : 'hover:bg-accent/30',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'block h-[2px] w-full rounded-full transition-colors duration-150',
                        isActive ? 'bg-primary' : done ? 'bg-primary/40' : 'bg-border group-hover:bg-border/80',
                      )}
                    />
                    <span className="flex items-center gap-1.5 px-2 pt-2 pb-1.5 min-w-0">
                      <span
                        aria-hidden
                        className={cn(
                          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
                          isActive
                            ? 'bg-primary text-primary-foreground border-primary'
                            : done
                              ? 'bg-primary/15 text-primary border-primary/40'
                              : 'bg-background text-muted-foreground border-border group-hover:border-foreground/40 group-hover:text-foreground',
                        )}
                      >
                        {done ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        ) : (
                          <NavIcon className="h-3 w-3" />
                        )}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 truncate text-[11px] leading-none transition-colors duration-150',
                          isActive
                            ? 'font-semibold text-foreground tracking-tight'
                            : done
                              ? 'font-medium text-foreground/80 group-hover:text-foreground'
                              : 'font-medium text-muted-foreground group-hover:text-foreground',
                        )}
                      >
                        {label}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Section description — step + title already live in the nav above */}
        <p className="text-sm text-muted-foreground mb-5">{section.description}</p>

        {/* Questions */}
        <Card>
          <CardContent className="p-4 space-y-5">
            {section.fields.map(field => renderField(field))}
          </CardContent>
        </Card>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 inset-x-0 bg-background border-t px-4 py-3 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 0}
          className="w-24"
        >
          Back
        </Button>

        <span className="text-sm text-muted-foreground">
          {step + 1} / {totalSteps}
        </span>

        <Button
          onClick={handleNext}
          className="w-24"
        >
          {step === totalSteps - 1 ? 'Submit' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
