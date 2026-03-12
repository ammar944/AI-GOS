'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { JourneyChatInput } from '@/components/journey/chat-input';
import { JourneyManusWelcome } from '@/components/journey/journey-manus-welcome';
import { cn } from '@/lib/utils';

export type JourneyManusPreviewScene = 'welcome' | 'prefill' | 'review' | 'chat';

interface JourneyManusPreviewProps {
  scene: JourneyManusPreviewScene;
  showSceneSwitcher?: boolean;
}

interface PreviewField {
  label: string;
  value: string;
}

interface PreviewManualField {
  label: string;
  value: string;
  helper: string;
  required?: boolean;
  rows?: number;
}

const SCENE_LINKS: Array<{ id: JourneyManusPreviewScene; label: string }> = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'prefill', label: 'Extraction' },
  { id: 'review', label: 'Review' },
  { id: 'chat', label: 'Strategist' },
];

const EXTRACTED_FIELDS: PreviewField[] = [
  { label: 'Company Name', value: 'Miana' },
  { label: 'Business Model', value: 'Real estate wholesaling software with CRM and calculators.' },
  { label: 'Ideal Customer Profile', value: 'US-based wholesalers who need faster lead qualification and cleaner offer math.' },
  { label: 'Product Description', value: 'A seller-finance and cash-offer workflow that helps investors evaluate and manage deals.' },
  { label: 'Value Proposition', value: 'Turn scattered underwriting and outreach into one operator workflow.' },
  { label: 'Testimonials URL', value: 'https://miana.ai/testimonials' },
];

const MANUAL_FIELDS: PreviewManualField[] = [
  {
    label: 'Top Competitors',
    value: 'Podio workflows, REsimpli, InvestorFuse',
    helper: 'Name the tools or systems buyers compare you against most often.',
    required: true,
  },
  {
    label: 'Pricing Tiers',
    value: 'Starter $197/mo, Team $497/mo, custom onboarding for brokerages.',
    helper: 'Pricing or budget context is required before market research starts.',
    required: true,
    rows: 2,
  },
  {
    label: 'Goals',
    value: 'Increase qualified demos, reduce dead leads, and improve underwriting confidence.',
    helper: 'What matters in the next 90 days?',
    required: true,
    rows: 2,
  },
];

const CHAT_NOTES = [
  'I turned the homepage into an initial brief. The strongest narrative is speed-to-offer with less spreadsheet drift.',
  'Before I dispatch Competitor Intel, confirm whether we should frame this primarily for solo wholesalers or team operators.',
];

const PROOF_ITEMS = [
  { label: 'Market Overview', detail: 'Approved · 4 signals captured', status: 'complete' },
  { label: 'Competitor Intel', detail: 'Queued after ICP confirmation', status: 'active' },
  { label: 'Offer Analysis', detail: 'Waiting on pricing context', status: 'queued' },
];

function PreviewHeader(): React.JSX.Element {
  return (
    <>
      <header className="border-b border-black/6 bg-[#faf8f3]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-6 px-6 py-4 lg:px-8">
          <Link
            href="/journey"
            className="flex items-center gap-2 text-[15px] font-medium tracking-[-0.02em] text-[#1f1d18]"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white text-[11px] font-semibold">
              AG
            </span>
            AIGOS
          </Link>

          <nav className="hidden items-center gap-7 text-[13px] text-[#67635b] md:flex">
            <Link href="/journey" className="transition-colors hover:text-[#1f1d18]">
              Journey
            </Link>
            <Link href="/blueprints" className="transition-colors hover:text-[#1f1d18]">
              Blueprints
            </Link>
            <Link href="/dashboard" className="transition-colors hover:text-[#1f1d18]">
              Dashboard
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-full border border-black/8 bg-white px-3 py-2 text-[12px] font-medium text-[#1f1d18] shadow-[0_8px_22px_rgba(17,16,13,0.06)] transition-colors hover:bg-[#f8f6f1]"
            >
              Library
            </Link>
            <Link
              href="/settings"
              className="rounded-full border border-black/8 px-3 py-2 text-[12px] text-[#67635b] transition-colors hover:border-black/12 hover:text-[#1f1d18]"
            >
              Settings
            </Link>
          </div>
        </div>
      </header>

      <div className="border-b border-black/5 bg-[#f1eee8] px-6 py-3 text-center text-[12px] text-[#666159]">
        Preview route for the Manus-inspired Journey redesign.
      </div>
    </>
  );
}

function SceneSwitcher({
  scene,
}: {
  scene: JourneyManusPreviewScene;
}): React.JSX.Element {
  return (
    <div className="fixed bottom-5 right-5 z-20 rounded-full border border-black/8 bg-white/90 p-1.5 shadow-[0_20px_60px_rgba(17,16,13,0.1)] backdrop-blur">
      <div className="flex items-center gap-1">
        {SCENE_LINKS.map((link) => (
          <Link
            key={link.id}
            href={`/test/journey-manus?scene=${link.id}`}
            className={cn(
              'rounded-full px-3 py-2 text-[12px] transition-colors',
              scene === link.id
                ? 'bg-[#1f1d18] text-white'
                : 'text-[#68635b] hover:bg-[#f2efe8] hover:text-[#1f1d18]',
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function PreviewFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div className="min-h-screen bg-[#f6f5f1] text-[#1f1d18]">
      <PreviewHeader />
      <main className="px-6 pb-24 pt-14 lg:px-8">
        <div className="mx-auto max-w-[1180px]">
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#8a867d]">{eyebrow}</p>
            <h1
              className="mx-auto mt-6 max-w-4xl text-[3.1rem] leading-[1.02] tracking-[-0.04em] text-[#1f1d18] sm:text-[4.1rem]"
              style={{
                fontFamily:
                  'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
              }}
            >
              {title}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-[#6b675f]">
              {description}
            </p>
          </div>
          <div className="mt-12">{children}</div>
        </div>
      </main>
    </div>
  );
}

function ExtractedFieldCard({ field }: { field: PreviewField }): React.JSX.Element {
  return (
    <div className="paper-surface rounded-[22px] p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#918b81]">{field.label}</p>
      <p className="mt-2 text-[14px] leading-6 text-[#27241f]">{field.value}</p>
    </div>
  );
}

function ManusPrefillScene(): React.JSX.Element {
  return (
    <PreviewFrame
      eyebrow="Context Extraction"
      title="Reading the public footprint before research starts"
      description="This is the lighter intake system the real Journey flow now uses while it extracts fields from a homepage and LinkedIn page."
    >
      <div className="mx-auto max-w-[880px] space-y-6">
        <div className="paper-surface rounded-[28px] p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[12px] uppercase tracking-[0.18em] text-[#918b81]">
                Extraction Progress
              </p>
              <h3 className="mt-2 text-[1.25rem] font-medium tracking-[-0.03em] text-[#1f1d18]">
                6/13 fields captured
              </h3>
            </div>
            <div className="rounded-full border border-black/8 bg-[#f3f0e9] px-3 py-1 text-[12px] text-[#5f5a52]">
              Scanning pages and metadata
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e7e1d6]">
            <div className="h-full w-[46%] rounded-full bg-[#3c83f6]" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {EXTRACTED_FIELDS.map((field) => (
            <ExtractedFieldCard key={field.label} field={field} />
          ))}
        </div>
      </div>
    </PreviewFrame>
  );
}

function ReviewField({
  field,
}: {
  field: PreviewManualField;
}): React.JSX.Element {
  return (
    <div className="rounded-[22px] border border-black/8 bg-[#fbfaf7] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#1f1d18]">{field.label}</p>
        {field.required ? <span className="text-[11px] text-[#9a6b2f]">Required</span> : null}
      </div>
      {field.rows && field.rows > 1 ? (
        <textarea
          rows={field.rows}
          readOnly
          value={field.value}
          className="mt-3 w-full resize-none rounded-[18px] border border-black/10 bg-white px-3 py-2.5 text-sm text-[#1f1d18] outline-none"
        />
      ) : (
        <input
          readOnly
          value={field.value}
          className="mt-3 w-full rounded-[18px] border border-black/10 bg-white px-3 py-2.5 text-sm text-[#1f1d18] outline-none"
        />
      )}
      <p className="mt-2 text-xs leading-6 text-[#6f6a61]">{field.helper}</p>
    </div>
  );
}

function ManusReviewScene(): React.JSX.Element {
  return (
    <PreviewFrame
      eyebrow="Review Checkpoint"
      title="Accept the web context, then lock the operator inputs"
      description="This checkpoint is where Journey stops feeling like a form and instead feels like a premium intake review before the real strategy work starts."
    >
      <div className="mx-auto max-w-[920px] space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {EXTRACTED_FIELDS.slice(0, 4).map((field) => (
            <ExtractedFieldCard key={field.label} field={field} />
          ))}
        </div>

        <div className="paper-surface rounded-[28px] p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#918b81]">
                Human Context
              </p>
              <h3 className="mt-2 text-[1.4rem] font-medium tracking-[-0.03em] text-[#1f1d18]">
                Fill what the web cannot know reliably
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#676159]">
                The operator still needs to confirm the category competitors, pricing context,
                and 90-day goals before research can run without guesswork.
              </p>
            </div>
            <span className="rounded-full border border-black/8 bg-[#f3f0e9] px-3 py-1 text-[12px] text-[#5f5a52]">
              Required before research starts
            </span>
          </div>

          <div className="mt-5 rounded-[20px] border border-[#d99b52]/22 bg-[#fbf2e6] px-4 py-3">
            <p className="text-sm text-[#915f21]">
              Complete the required manual inputs before Market Overview can begin.
            </p>
            <p className="mt-1 text-xs text-[#a67941]">
              Missing: target goals and one competitor proof point.
            </p>
          </div>

          <div className="mt-6 grid gap-4">
            {MANUAL_FIELDS.map((field) => (
              <ReviewField key={field.label} field={field} />
            ))}
          </div>

          <button
            type="button"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#1f1d18] px-6 py-3 text-sm font-medium text-white"
          >
            Start Market Overview
          </button>
        </div>
      </div>
    </PreviewFrame>
  );
}

function ProofRail(): React.JSX.Element {
  return (
    <div className="paper-surface rounded-[28px] p-6">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#918b81]">Proof Dock</p>
      <div className="mt-5 space-y-5">
        {PROOF_ITEMS.map((item) => (
          <div key={item.label} className="flex gap-3">
            <div
              className={cn(
                'mt-1.5 h-3 w-3 rounded-full',
                item.status === 'complete'
                  ? 'bg-[#2f9f65]'
                  : item.status === 'active'
                    ? 'bg-[#3c83f6]'
                    : 'bg-[#cfc8ba]',
              )}
            />
            <div>
              <p className="text-sm font-medium text-[#1f1d18]">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-[#6b675f]">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-[20px] border border-black/8 bg-[#fbfaf7] p-4">
        <div className="flex items-center justify-between text-[11px] text-[#8d877d]">
          <span>Journey readiness</span>
          <span>82%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e7e1d6]">
          <div className="h-full w-[82%] rounded-full bg-[#1f1d18]" />
        </div>
      </div>
    </div>
  );
}

function ManusChatScene(): React.JSX.Element {
  return (
    <PreviewFrame
      eyebrow="Strategist Handoff"
      title="Carry the same premium system into the operator conversation"
      description="This is the next step for the live chat surface: lighter evidence cards, calmer strategist notes, and a paper command bar instead of the current dark command-center split."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {CHAT_NOTES.map((note, index) => (
            <div key={note} className="paper-surface rounded-[26px] p-6">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#8b857b]">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-black/8 bg-white text-[10px] font-semibold text-[#1f1d18]">
                  AI
                </span>
                Strategist Note {index + 1}
              </div>
              <p className="mt-4 text-[16px] leading-8 text-[#28251f]">{note}</p>
            </div>
          ))}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="paper-surface rounded-[24px] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#918b81]">Evidence</p>
              <h3 className="mt-2 text-[1.1rem] font-medium text-[#1f1d18]">
                Category pressure is speed and certainty
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#676159]">
                Most market language clusters around faster underwriting, cleaner offer math,
                and less lead chaos. That is the anchor opportunity.
              </p>
            </div>
            <div className="paper-surface rounded-[24px] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#918b81]">Decision</p>
              <h3 className="mt-2 text-[1.1rem] font-medium text-[#1f1d18]">
                Choose the first ICP branch
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#676159]">
                Solo wholesalers need speed and simplicity. Team operators care more about CRM
                control, collaboration, and repeatability.
              </p>
            </div>
          </div>

          <JourneyChatInput
            onSubmit={() => {}}
            isLoading={false}
            variant="paper"
            placeholder="Ask Journey to turn this into a sharper paid acquisition brief..."
            className="max-w-none"
          />
        </div>

        <div>
          <ProofRail />
        </div>
      </div>
    </PreviewFrame>
  );
}

export function JourneyManusPreview({
  scene,
  showSceneSwitcher = true,
}: JourneyManusPreviewProps): React.JSX.Element {
  const content =
    scene === 'prefill'
      ? <ManusPrefillScene />
      : scene === 'review'
        ? <ManusReviewScene />
        : scene === 'chat'
          ? <ManusChatScene />
          : (
            <JourneyManusWelcome
              websiteUrl="https://miana.ai"
              linkedinUrl="https://linkedin.com/company/miana-ai"
              onWebsiteUrlChange={() => {}}
              onLinkedinUrlChange={() => {}}
              onAnalyze={() => {}}
              onSkip={() => {}}
            />
          );

  return (
    <>
      {content}
      {showSceneSwitcher ? <SceneSwitcher scene={scene} /> : null}
    </>
  );
}
