'use client';

import Link from 'next/link';
import {
  ArrowUp,
  Brain,
  FileText,
  Globe2,
  Link2,
  Search,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

export interface JourneyManusWelcomeProps {
  websiteUrl: string;
  linkedinUrl: string;
  onWebsiteUrlChange: (value: string) => void;
  onLinkedinUrlChange: (value: string) => void;
  onAnalyze: () => void;
  onSkip: () => void;
}

interface SourceInputProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  Icon: LucideIcon;
  required?: boolean;
}

interface AgentStep {
  title: string;
  detail: string;
  state: 'ready' | 'active' | 'pending';
}

interface AgentStepRowProps {
  step: AgentStep;
}

interface ModeChipProps {
  label: string;
  Icon: LucideIcon;
}

const AGENT_STEPS: AgentStep[] = [
  {
    title: 'Company research',
    detail: 'Website and optional LinkedIn context extract the first onboarding draft.',
    state: 'ready',
  },
  {
    title: 'Onboarding review',
    detail: 'You complete the profile before any GTM section is generated.',
    state: 'active',
  },
  {
    title: 'Section synthesis loop',
    detail: 'AI-GOS tackles GTM sections one by one from the completed context.',
    state: 'pending',
  },
];

const MODE_CHIPS: ModeChipProps[] = [
  { label: 'Research', Icon: Search },
  { label: 'Sources', Icon: Globe2 },
  { label: 'Synthesis', Icon: FileText },
  { label: 'Review', Icon: Brain },
];

function SourceInput({
  id,
  label,
  value,
  placeholder,
  onChange,
  Icon,
  required = false,
}: SourceInputProps): React.JSX.Element {
  return (
    <div className="rounded-[8px] border border-white/10 bg-white/[0.035] px-4 py-3">
      <label
        htmlFor={id}
        className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/38"
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </label>
      <input
        id={id}
        type="url"
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/24"
      />
    </div>
  );
}

function AgentStepRow({ step }: AgentStepRowProps): React.JSX.Element {
  return (
    <div className="flex gap-3 rounded-[8px] border border-white/[0.07] bg-black/20 px-3.5 py-3">
      <span
        className={cn(
          'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
          step.state === 'ready'
            ? 'bg-[#50f8e4]'
            : step.state === 'active'
              ? 'bg-[#365eff]'
              : 'bg-white/18',
        )}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-white/88">{step.title}</span>
        <span className="mt-1 block text-xs leading-5 text-white/48">
          {step.detail}
        </span>
      </span>
    </div>
  );
}

function ModeChip({ label, Icon }: ModeChipProps): React.JSX.Element {
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 text-xs font-medium text-white/66">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function ReportPreview(): React.JSX.Element {
  return (
    <article className="overflow-hidden rounded-[8px] border border-white/10 bg-[#0d1018]/92">
      <div className="flex h-11 items-center justify-between border-b border-white/[0.07] px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-white/42">
        <span>gtm-synthesis.md</span>
        <span>waiting for completed onboarding</span>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#50f8e4]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Agent workspace
        </div>
        <h2 className="mt-3 text-xl font-semibold leading-7 tracking-[-0.04em] text-white">
          Sections synthesize after the profile is complete.
        </h2>
        <p className="mt-3 text-sm leading-7 text-white/62">
          The first research pass extracts company context. After you review the
          onboarding fields, AI-GOS starts the GTM report sections one at a time.
        </p>
        <div className="mt-4 rounded-r-[8px] border-l-2 border-[#365eff] bg-[#365eff]/8 px-4 py-3 text-sm leading-6 text-white/70">
          Context corrections happen before the section loop starts, so each
          artifact is grounded in the completed profile.
        </div>
      </div>
    </article>
  );
}

export function JourneyManusWelcome({
  websiteUrl,
  linkedinUrl,
  onWebsiteUrlChange,
  onLinkedinUrlChange,
  onAnalyze,
  onSkip,
}: JourneyManusWelcomeProps): React.JSX.Element {
  const canAnalyze = websiteUrl.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#06080d] text-white">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[68px_1fr]">
        <aside className="hidden border-r border-white/10 bg-[#0a0d14]/70 px-2 py-3 xl:flex xl:flex-col xl:items-center xl:gap-2">
          <Link
            href="/journey"
            className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#365eff] text-sm font-black text-white shadow-[0_14px_34px_rgba(54,94,255,0.24)]"
          >
            AG
          </Link>
          {['Journey', 'Research', 'Reports', 'Settings'].map((item, index) => (
            <div
              key={item}
              className={cn(
                'grid h-10 w-10 place-items-center rounded-[8px] text-xs font-bold',
                index === 0
                  ? 'bg-[#365eff]/12 text-[#8faaff]'
                  : 'text-white/34',
              )}
              title={item}
            >
              {item.slice(0, 1)}
            </div>
          ))}
          <div className="mt-auto grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-xs font-bold text-white/70">
            A
          </div>
        </aside>

        <section className="flex min-h-screen flex-col">
          <header className="shrink-0 border-b border-white/10 bg-[#06080d]/90 px-4 py-3 sm:px-6">
            <div className="mx-auto flex w-full max-w-[980px] items-center justify-between gap-4">
              <Link href="/journey" className="flex min-w-0 items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#365eff]/25 bg-[#365eff]/11 text-sm font-black text-[#8faaff] xl:hidden">
                  AG
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">
                    AI-GOS Journey
                  </span>
                  <span className="block truncate text-xs text-white/42">
                    research worker connected to the report workspace
                  </span>
                </span>
              </Link>

              <div className="flex items-center gap-2">
                <span className="hidden h-8 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 text-xs font-semibold text-white/54 sm:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#50f8e4] shadow-[0_0_0_4px_rgba(80,248,228,0.12)]" />
                  agent ready
                </span>
                <Link
                  href="/dashboard"
                  className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-white/58 transition-colors hover:text-white"
                >
                  Library
                </Link>
              </div>
            </div>
          </header>

          <main className="grid flex-1 place-items-center px-4 py-5 sm:px-6">
            <div className="grid h-[min(760px,calc(100vh-102px))] min-h-[620px] w-full max-w-[980px] grid-rows-[auto_1fr_auto] overflow-hidden rounded-[8px] border border-white/10 bg-[#0a0d14] shadow-[0_24px_90px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.05)]">
              <section className="border-b border-white/[0.07] bg-[#0d1018] px-5 py-6 text-center sm:px-8">
                <div className="inline-flex h-8 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 font-mono text-[11px] font-semibold text-white/52">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#50f8e4]" />
                  GTM research coworker
                </div>
                <h1 className="mx-auto mt-4 max-w-[720px] text-[2.2rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white sm:text-[2.55rem]">
                  Start from a link. Work inside the report.
                </h1>
                <p className="mx-auto mt-3 max-w-[650px] text-sm leading-6 text-white/52">
                  Enter the company source and AI-GOS will open the workspace,
                  extract onboarding context, and then synthesize GTM sections
                  one by one after the profile is complete.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {MODE_CHIPS.map((chip) => (
                    <ModeChip key={chip.label} label={chip.label} Icon={chip.Icon} />
                  ))}
                </div>
              </section>

              <section className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
                  <div className="rounded-[8px] border border-white/10 bg-white/[0.028] p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/38">
                      Run sequence
                    </p>
                    <div className="mt-4 grid gap-2.5">
                      {AGENT_STEPS.map((step) => (
                        <AgentStepRow key={step.title} step={step} />
                      ))}
                    </div>
                  </div>

                  <ReportPreview />
                </div>
              </section>

              <footer className="border-t border-white/10 bg-[#0d1018] p-4">
                <form
                  className="rounded-[8px] border border-[#50f8e4]/22 bg-[#11151f] p-4 shadow-[0_0_0_5px_rgba(80,248,228,0.035),0_22px_80px_rgba(54,94,255,0.16)]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (canAnalyze) {
                      onAnalyze();
                    }
                  }}
                >
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.86fr)]">
                    <SourceInput
                      id="journey-company-url"
                      label="Company website"
                      value={websiteUrl}
                      onChange={onWebsiteUrlChange}
                      placeholder="https://your-company.com"
                      Icon={Link2}
                      required
                    />
                    <SourceInput
                      id="journey-linkedin-url"
                      label="LinkedIn optional"
                      value={linkedinUrl}
                      onChange={onLinkedinUrlChange}
                      placeholder="https://linkedin.com/company/..."
                      Icon={Globe2}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs leading-5 text-white/42">
                      Research extracts onboarding fields first. GTM section
                      synthesis starts after you complete the profile.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onSkip}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/58 transition-colors hover:border-white/18 hover:text-white/78"
                      >
                        Complete manually
                      </button>
                      <button
                        type="submit"
                        disabled={!canAnalyze}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#365eff] text-white shadow-[0_12px_28px_rgba(54,94,255,0.28)] transition-opacity hover:opacity-92 disabled:opacity-35"
                        aria-label="Extract onboarding fields"
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </form>
              </footer>
            </div>
          </main>
        </section>
      </div>
    </div>
  );
}
