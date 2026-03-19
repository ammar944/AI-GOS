'use client';

import Link from 'next/link';

import { JourneyChatInput } from '@/components/journey/chat-input';
import { cn } from '@/lib/utils';

export type JourneyPremiumPreviewScene = 'welcome' | 'cards' | 'artifact' | 'chat';

export interface JourneyPremiumPreviewProps {
  scene: JourneyPremiumPreviewScene;
  showSceneSwitcher?: boolean;
}

interface QuickStartCard {
  title: string;
  description: string;
  status: string;
}

interface EvidenceCard {
  module: string;
  headline: string;
  summary: string;
  proofPoints: string[];
  status: string;
  metrics: Array<{ label: string; value: string }>;
}

const SCENE_LINKS: Array<{ id: JourneyPremiumPreviewScene; label: string }> = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'cards', label: 'Cards' },
  { id: 'artifact', label: 'Artifact' },
  { id: 'chat', label: 'Chat' },
];

const QUICK_START_CARDS: QuickStartCard[] = [
  {
    title: 'Homepage teardown',
    description: 'Tighten the homepage into a sharper acquisition brief before the first worker wave runs.',
    status: 'Ready',
  },
  {
    title: 'Competitor pressure map',
    description: 'Frame the category battle before the offer and ICP narratives lock in.',
    status: 'Queued next',
  },
  {
    title: 'Offer gap scan',
    description: 'Stress-test the current offer stack and expose the weakest proof points.',
    status: 'Needs pricing context',
  },
  {
    title: 'ICP refinement',
    description: 'Pick the first buyer branch so research and media direction stay aligned.',
    status: 'Operator input required',
  },
];

const EVIDENCE_CARDS: EvidenceCard[] = [
  {
    module: '01 · Market Overview',
    headline: 'Paid search intent beats the homepage story',
    summary: 'Urgent, intent-led search demand is the stronger entry point than broad CRM framing.',
    proofPoints: [
      'Search behavior clusters around urgent deal evaluation, not general CRM interest.',
    ],
    status: 'High confidence',
    metrics: [
      { label: 'Signals', value: '14' },
      { label: 'Sources', value: '9' },
      { label: 'Confidence', value: 'High' },
    ],
  },
  {
    module: '02 · Competitor Intel',
    headline: 'Competitors explain process, not proof',
    summary: 'The wedge is not more explanation. It is more outcome proof with underwriting specificity.',
    proofPoints: [
      'Pricing detail is visible, but proof blocks are still thin and repetitive.',
    ],
    status: 'Ready for review',
    metrics: [
      { label: 'Competitors', value: '6' },
      { label: 'Gaps', value: '3' },
      { label: 'Urgency', value: 'Rising' },
    ],
  },
  {
    module: '03 · ICP Validation',
    headline: 'Operators and solo buyers need separate narratives',
    summary: 'The first paid branch should split by operating model before any copy direction gets approved.',
    proofPoints: [
      'Blending both audiences weakens the first click before the offer even lands.',
    ],
    status: 'Needs branch decision',
    metrics: [
      { label: 'Branches', value: '2' },
      { label: 'Reachability', value: 'Qualified' },
      { label: 'Risk', value: 'Mixed messaging' },
    ],
  },
];

const WORKSPACE_STEPS: Array<{
  title: string;
  detail: string;
  tone: 'active' | 'ready' | 'waiting';
}> = [
  { title: 'Intake brief', detail: 'Ready to run', tone: 'active' },
  { title: 'Research wave', detail: '3 modules staged', tone: 'ready' },
  { title: 'Approval queue', detail: '1 operator decision open', tone: 'waiting' },
];

const DOCK_SECTIONS: Array<{
  title: string;
  detail: string;
  tone: 'positive' | 'active' | 'neutral';
}> = [
  { title: 'Market Overview', detail: 'Approved · 9 sources', tone: 'positive' },
  { title: 'Competitor Intel', detail: 'Ready for review', tone: 'active' },
  { title: 'ICP Validation', detail: 'Waiting on buyer branch', tone: 'neutral' },
];

function PremiumPreviewSidebar(): React.JSX.Element {
  const items = ['Journey', 'Research', 'Approvals', 'Artifacts'];

  return (
    <aside className="hidden w-72 flex-none border-r border-[var(--border-default)] bg-[#050608] px-5 py-6 xl:flex xl:flex-col">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-hover)] text-sm font-semibold text-[var(--text-primary)]">
          AG
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">AIGOS</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Operator preview</p>
        </div>
      </div>

      <div className="mt-6 rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
            Current cycle
          </p>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300">
            Live
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {WORKSPACE_STEPS.map((step) => (
            <div key={step.title} className="flex items-start gap-3 rounded-[18px] border border-[var(--border-default)] bg-black/18 px-3 py-3">
              <div
                className={cn(
                  'mt-1.5 h-2.5 w-2.5 rounded-full',
                  step.tone === 'active'
                    ? 'bg-brand-accent'
                    : step.tone === 'ready'
                      ? 'bg-emerald-400'
                      : 'bg-amber-300',
                )}
              />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{step.title}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <nav className="mt-6 space-y-1">
        {items.map((item) => (
          <div
            key={item}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-sm',
              item === 'Journey'
                ? 'border-brand-accent/20 bg-brand-accent/10 font-medium text-brand-accent'
                : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]',
            )}
          >
            {item}
          </div>
        ))}
      </nav>

      <div className="mt-auto rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          Operator posture
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          Dense surfaces, explicit review routing, and visible section state are what the production app is currently missing.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {['3 active modules', '1 approval pending', 'Worker mesh online'].map((item) => (
            <span
              key={item}
              className="rounded-full border border-[var(--border-default)] bg-black/18 px-3 py-1 text-[11px] text-[var(--text-secondary)]"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}

function PremiumPreviewDock(): React.JSX.Element {
  return (
    <aside className="hidden w-[22rem] flex-none border-l border-[var(--border-default)] bg-[#050608] px-5 py-6 xl:flex xl:flex-col">
      <div className="rounded-[26px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(16,18,22,0.94),rgba(10,10,12,0.9))] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
            Proof dock
          </p>
          <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
            Review
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {DOCK_SECTIONS.map((section) => (
            <div key={section.title} className="rounded-[18px] border border-[var(--border-default)] bg-black/18 px-3 py-3">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'mt-1.5 h-2.5 w-2.5 rounded-full',
                    section.tone === 'positive'
                      ? 'bg-emerald-400'
                      : section.tone === 'active'
                        ? 'bg-brand-accent'
                        : 'bg-[var(--bg-hover)]',
                  )}
                />
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{section.title}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{section.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          Evidence health
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            ['Sources', '9'],
            ['Gaps', '3'],
            ['Queues', '2'],
            ['Confidence', 'High'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[18px] border border-[var(--border-default)] bg-black/18 px-3 py-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                {label}
              </p>
              <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          Next move
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          Approve the market thesis, then branch the ICP before another research wave expands the scope.
        </p>
      </div>
    </aside>
  );
}

function PremiumShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="min-h-screen bg-[#050608] text-[#E5E5E5]">
      <div className="flex min-h-screen">
        <PremiumPreviewSidebar />

        <main className="relative flex min-h-screen min-w-0 flex-1 flex-col overflow-hidden bg-[#07090c]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(66,153,225,0.08),transparent_24%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.05),transparent_18%),linear-gradient(180deg,rgba(8,10,12,1),rgba(5,6,8,1)),linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[length:auto,auto,auto,32px_32px,32px_32px]" />
          <div className="relative flex min-h-screen flex-col">
            <div className="border-b border-[var(--border-default)] bg-[#07090c]/88 px-6 py-4 backdrop-blur sm:px-7">
              <div className="mx-auto flex max-w-[72rem] flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                    <span>{eyebrow}</span>
                    <span className="text-[var(--text-quaternary)]">•</span>
                    <span>Worker mesh online</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {['Preview only', 'No live edits', 'Desktop review'].map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-3 py-1 text-[11px] text-[var(--text-secondary)]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="max-w-3xl">
                    <h1 className="text-[2rem] font-medium tracking-[-0.05em] text-[var(--text-primary)] sm:text-[2.3rem]">
                      {title}
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                      {description}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ['Surface', 'Journey'],
                      ['State', 'Preview'],
                      ['Owner', 'Operator'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-[18px] border border-[var(--border-default)] bg-black/18 px-3 py-3">
                        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                          {label}
                        </p>
                        <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 sm:px-7">
              <div className="mx-auto max-w-[72rem]">{children}</div>
            </div>
          </div>
        </main>

        <PremiumPreviewDock />
      </div>
    </div>
  );
}

function SceneSwitcher({
  scene,
}: {
  scene: JourneyPremiumPreviewScene;
}): React.JSX.Element {
  return (
    <div className="fixed bottom-5 right-5 z-20 rounded-full border border-[var(--border-default)] bg-[#0e0d0c]/94 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.34)] backdrop-blur">
      <div className="flex items-center gap-1">
        {SCENE_LINKS.map((link) => (
          <Link
            key={link.id}
            href={`/test/journey-premium?scene=${link.id}`}
            className={cn(
              'rounded-full px-3 py-2 text-[12px] transition-colors',
              scene === link.id
                ? 'bg-brand-accent text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function WelcomeScene(): React.JSX.Element {
  return (
    <PremiumShell
      eyebrow="Journey Premium Preview · Welcome"
      title="Stage the strategic brief"
      description="Keep the existing Journey shell, but make the intake feel like a premium operator brief instead of a generic start screen."
    >
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.38fr)_minmax(20rem,0.82fr)]">
        <section className="rounded-[28px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(17,20,24,0.94),rgba(10,10,12,0.9))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-brand-accent">
                Strategic operator brief
              </p>
              <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">
                Turn one homepage into a research-ready operating brief
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                The brief needs to lock market context, buyer branch, and approval posture before any worker wave expands the scope.
              </p>
            </div>
            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em] text-emerald-300">
              Readiness 82%
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ['Primary objective', 'Stage a premium market overview in one pass'],
              ['Decision branch', 'Solo wholesalers vs operator teams'],
              ['Proof posture', 'Lead with underwriting certainty and visible evidence'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[18px] border border-[var(--border-default)] bg-black/18 px-4 py-3.5">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                  {label}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[24px] border border-[var(--border-default)] bg-black/18 p-5">
            <div className="flex items-center justify-between gap-3">
              <label className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                Company footprint
              </label>
              <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                Live sample
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
              <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
                https
              </span>
              <span className="min-w-0 flex-1 text-sm text-[var(--text-secondary)]">https://miana.ai</span>
              <button
                type="button"
                className="rounded-full border border-brand-accent/20 bg-brand-accent/10 px-4 py-2 text-sm text-brand-accent"
              >
                Analyze footprint
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ['Homepage', 'Primary signal source'],
                ['LinkedIn', 'Optional founder proof'],
                ['Pricing', 'Add only if offer gaps stay unclear'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[18px] border border-[var(--border-default)] bg-[#0c0f13] px-3 py-3">
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    {label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <aside className="rounded-[24px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(16,18,22,0.94),rgba(10,10,12,0.9))] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.24)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                Launch plan
              </p>
              <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                3 steps
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Turn the current footprint into an operator-ready brief, queue the first evidence modules, then pause on the buyer branch before more work fans out.
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-full bg-brand-accent px-4 py-3 text-sm font-medium text-white"
            >
              Start operator brief
            </button>
            <div className="mt-4 space-y-2">
              {[
                'Run homepage teardown',
                'Queue competitor pressure map',
                'Hold ICP branch for signoff',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[16px] border border-[var(--border-default)] bg-black/18 px-3 py-3 text-sm text-[var(--text-secondary)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </aside>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            {QUICK_START_CARDS.map((card) => (
              <div
                key={card.title}
                className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.22)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">{card.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{card.description}</p>
                  </div>
                  <span className="rounded-full border border-[var(--border-default)] bg-black/20 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    {card.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        {[
          ['Why the current preview failed', 'Too much empty header space and not enough operational density.'],
          ['What this pass fixes', 'Real launch sequence, visible decision routing, and a tighter intake surface.'],
          ['What should remain next', 'Your actual Journey components, not decorative concept blocks.'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              {label}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{value}</p>
          </div>
        ))}
      </section>
    </PremiumShell>
  );
}

function EvidenceModuleCard({
  card,
}: {
  card: EvidenceCard;
}): React.JSX.Element {
  return (
    <div className="rounded-[24px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(16,18,22,0.94),rgba(10,10,12,0.9))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-brand-accent">
          {card.module}
        </p>
        <span className="rounded-full border border-[var(--border-default)] bg-black/20 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-secondary)]">
          {card.status}
        </span>
      </div>
      <h3 className="mt-3 text-[1.05rem] font-medium leading-6 tracking-[-0.03em] text-[var(--text-primary)]">
        {card.headline}
      </h3>
      <div className="mt-3 rounded-[18px] border border-[var(--border-default)] bg-black/18 px-4 py-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          Strategic read
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{card.summary}</p>
      </div>
      <div className="mt-3 space-y-2">
        {card.proofPoints.map((bullet) => (
          <div key={bullet} className="flex gap-3 text-sm leading-6 text-[var(--text-secondary)]">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-accent" />
            <span>{bullet}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {card.metrics.map((metric) => (
          <span
            key={metric.label}
            className="rounded-full border border-[var(--border-default)] bg-black/18 px-3 py-1.5 text-[11px] text-[var(--text-secondary)]"
          >
            <span className="text-[var(--text-tertiary)]">{metric.label}</span>
            {' '}
            <span className="text-[var(--text-secondary)]">{metric.value}</span>
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border-default)] pt-3">
        <p className="text-xs text-[var(--text-tertiary)]">Module ready for operator review</p>
        <button
          type="button"
          className="rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          Open full review
        </button>
      </div>
    </div>
  );
}

function CompactEvidenceModuleCard({
  card,
}: {
  card: EvidenceCard;
}): React.JSX.Element {
  return (
    <div className="rounded-[24px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(16,18,22,0.94),rgba(10,10,12,0.9))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-brand-accent">
          {card.module}
        </p>
        <span className="rounded-full border border-[var(--border-default)] bg-black/20 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          {card.status}
        </span>
      </div>
      <h3 className="mt-3 text-base font-medium leading-6 tracking-[-0.03em] text-[var(--text-primary)]">
        {card.headline}
      </h3>
      <div className="mt-3 rounded-[18px] border border-[var(--border-default)] bg-black/18 px-4 py-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          Strategic read
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{card.summary}</p>
      </div>
      <div className="mt-3 flex gap-3 text-sm leading-6 text-[var(--text-secondary)]">
        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-accent" />
        <span>{card.proofPoints[0]}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {card.metrics.slice(0, 2).map((metric) => (
          <span
            key={metric.label}
            className="rounded-full border border-[var(--border-default)] bg-black/18 px-3 py-1.5 text-[11px] text-[var(--text-secondary)]"
          >
            <span className="text-[var(--text-tertiary)]">{metric.label}</span>
            {' '}
            <span className="text-[var(--text-secondary)]">{metric.value}</span>
          </span>
        ))}
      </div>
      <button
        type="button"
        className="mt-4 w-full rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
      >
        Open full review
      </button>
    </div>
  );
}

function ReviewRoutingPanel(): React.JSX.Element {
  return (
    <aside className="rounded-[24px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(16,18,22,0.94),rgba(10,10,12,0.9))] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
        Review routing
      </p>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
        Keep the handoff obvious: approve the market thesis first, branch ICP next, then unlock deeper competitor proof.
      </p>
      <div className="mt-4 space-y-2">
        {[
          'Approve market overview',
          'Choose first buyer branch',
          'Re-open competitor proof only if objections stay weak',
        ].map((item) => (
          <div
            key={item}
            className="rounded-[16px] border border-[var(--border-default)] bg-black/18 px-3 py-3 text-sm text-[var(--text-secondary)]"
          >
            {item}
          </div>
        ))}
      </div>
    </aside>
  );
}

function CardsScene(): React.JSX.Element {
  return (
    <PremiumShell
      eyebrow="Journey Premium Preview · Research Cards"
      title="Evidence modules"
      description="The cards should feel like concise research dossiers: more trust, less terminal noise, and a clearer handoff into review."
    >
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.78fr)]">
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['3 active modules', 'Research is staged, not scattered.'],
              ['1 approval path', 'Only one decision should block the next wave.'],
              ['9 source bundle', 'Proof depth should be visible on the surface.'],
            ].map(([title, body]) => (
              <div
                key={title}
                className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3"
              >
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                  {title}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
              </div>
            ))}
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {EVIDENCE_CARDS.slice(0, 2).map((card) => (
              <EvidenceModuleCard key={card.module} card={card} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <ReviewRoutingPanel />
          <CompactEvidenceModuleCard card={EVIDENCE_CARDS[2]} />
        </section>
      </div>
    </PremiumShell>
  );
}

function ArtifactScene(): React.JSX.Element {
  return (
    <PremiumShell
      eyebrow="Journey Premium Preview · Artifact"
      title="Decision dock"
      description="Review should feel like one tight approval surface, not a detached document viewer with feedback split back into chat."
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.72fr)]">
        <section className="space-y-4">
          <div className="rounded-[26px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(16,18,22,0.94),rgba(10,10,12,0.9))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-brand-accent">
                  Review the market overview before dispatching the next wave
                </p>
                <h2 className="mt-2 text-[1.5rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">
                  Distill the category into a decision, not a wall of output
                </h2>
              </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300">
                Ready for approval
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ['Thesis', 'Search demand rewards speed and underwriting certainty.'],
                ['Risk', 'Mixed audience messaging weakens the first paid click.'],
                ['Decision', 'Branch solo vs operator teams before more research expands.'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[18px] border border-[var(--border-default)] bg-black/18 px-4 py-3">
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    {label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                Key findings
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
                <li>Search demand favors immediate underwriting confidence over broad CRM framing.</li>
                <li>The strongest positioning angle is speed with fewer spreadsheet errors.</li>
                <li>Current homepage copy underplays proof and overplays feature breadth.</li>
              </ul>
            </div>
            <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                Evidence pack
              </p>
              <div className="mt-4 space-y-3">
                {[
                  '9 sources validated',
                  '4 competitor proof gaps mapped',
                  '2 audience branches still unresolved',
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-[16px] border border-[var(--border-default)] bg-black/18 px-3 py-3 text-sm text-[var(--text-secondary)]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[24px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(16,18,22,0.94),rgba(10,10,12,0.9))] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.26)]">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              Actions
            </p>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                className="w-full rounded-full bg-brand-accent px-4 py-3 text-sm font-medium text-white"
              >
                Approve section
              </button>
              <button
                type="button"
                className="w-full rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-secondary)]"
              >
                Request changes
              </button>
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              Review routing
            </p>
            <div className="mt-4 space-y-2">
              {[
                'Approve market thesis',
                'Lock buyer branch',
                'Resume competitor deepening only if needed',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[16px] border border-[var(--border-default)] bg-black/18 px-3 py-3 text-sm text-[var(--text-secondary)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </PremiumShell>
  );
}

function ChatScene(): React.JSX.Element {
  return (
    <PremiumShell
      eyebrow="Journey Premium Preview · Chat"
      title="Operator conversation"
      description="The chat surface should inherit the same system: evidence-forward notes above, premium operator bar below, and no mode break when the work turns conversational."
    >
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
          <div className="rounded-[24px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(16,18,22,0.94),rgba(10,10,12,0.9))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              Strategist note
            </p>
            <p className="mt-4 text-[1rem] leading-7 text-[var(--text-secondary)]">
              Keep the offer narrative anchored on faster deal certainty. The next approval should decide whether the first paid branch is solo wholesalers or team operators.
            </p>
          </div>

          <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              Live context
            </p>
            <div className="mt-4 space-y-2">
              {[
                'Market overview approved',
                'Competitor proof waiting on review',
                'ICP branch is the open decision',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[16px] border border-[var(--border-default)] bg-black/18 px-3 py-3 text-sm text-[var(--text-secondary)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {EVIDENCE_CARDS.slice(0, 2).map((card) => (
            <EvidenceModuleCard key={card.module} card={card} />
          ))}
        </div>

        <div className="rounded-[24px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(16,18,22,0.94),rgba(10,10,12,0.9))] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.24)]">
          <JourneyChatInput
            onSubmit={() => {}}
            isLoading={false}
            variant="premium"
            placeholder="Direct the next move, refine the brief, or approve the current section..."
            className="max-w-none"
          />
        </div>
      </div>
    </PremiumShell>
  );
}

export function JourneyPremiumPreview({
  scene,
  showSceneSwitcher = true,
}: JourneyPremiumPreviewProps): React.JSX.Element {
  const content =
    scene === 'cards'
      ? <CardsScene />
      : scene === 'artifact'
        ? <ArtifactScene />
        : scene === 'chat'
          ? <ChatScene />
          : <WelcomeScene />;

  return (
    <>
      {content}
      {showSceneSwitcher ? <SceneSwitcher scene={scene} /> : null}
    </>
  );
}
