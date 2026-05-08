'use client';

import { useRef } from 'react';
import { ArrowRight, CheckCircle2, CircleDashed, FileText, Globe2, Search, Send, Sparkles, TerminalSquare } from 'lucide-react';
import { motion } from 'framer-motion';

export interface JourneyManusWelcomeProps {
  websiteUrl: string;
  onWebsiteUrlChange: (value: string) => void;
  onAnalyze: () => void;
  linkedinUrl?: string;
  onLinkedinUrlChange?: (value: string) => void;
  onSkip?: () => void;
}

const AGENT_STEPS = [
  { label: 'Company research corpus', detail: 'Source collection + analysis', icon: Search, state: 'ready' },
  { label: 'GTM specialist analysis', detail: 'Market, ICP, competitors, offer, demand', icon: Sparkles, state: 'ready' },
  { label: 'Report artifact', detail: 'Evidence-backed GTM sections, not schema cards', icon: FileText, state: 'queued' },
];

const SPECIALISTS = [
  'Market Category',
  'Buyer / ICP',
  'Competitive Positioning',
  'VOC + Objections',
  'Demand Intent',
  'GTM Synthesis',
];

export function JourneyManusWelcome({
  websiteUrl,
  onWebsiteUrlChange,
  onAnalyze,
}: JourneyManusWelcomeProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const canAnalyze = websiteUrl.trim().length > 0;

  const submit = (): void => {
    if (!canAnalyze) {
      inputRef.current?.focus();
      return;
    }

    onAnalyze();
  };

  return (
    <main className="flex h-full min-h-0 min-w-0 flex-1 bg-[#070707] text-[#f6f3ea]">
      <section className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(360px,0.78fr)_minmax(560px,1.22fr)]">
        <motion.aside
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="flex min-h-0 flex-col border-r border-white/[0.07] bg-[#0b0b0a]"
        >
          <div className="border-b border-white/[0.07] px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#85827a]">
                <TerminalSquare className="h-4 w-4 text-[#8aa4ff]" aria-hidden="true" />
                Agent console
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-200">
                Ready
              </div>
            </div>
            <h1 className="max-w-[14ch] text-[42px] font-semibold leading-[0.94] tracking-[-0.045em] text-[#f8f5eb]">
              Build the GTM report like an agent run.
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#9c998f]">
              Paste a company URL. AI-GOS builds a source-backed research corpus, runs GTM specialist analysis, and writes a live report artifact.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <form
              className="rounded-[16px] border border-white/[0.08] bg-[#121211] p-2 shadow-[0_24px_90px_rgba(0,0,0,0.38)]"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <label htmlFor="journey-company-url" className="mb-2 flex items-center gap-2 px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#8d897d]">
                <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
                Company URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  id="journey-company-url"
                  type="text"
                  value={websiteUrl}
                  onChange={(event) => onWebsiteUrlChange(event.target.value)}
                  placeholder="https://company.com"
                  className="min-w-0 flex-1 rounded-[12px] border border-white/[0.06] bg-[#090909] px-4 py-3 text-sm text-[#f6f3ea] outline-none transition-colors placeholder:text-[#67645d] focus:border-[#5577ff]/60"
                />
                <button
                  type="submit"
                  disabled={!canAnalyze}
                  aria-label="Start research"
                  className="flex h-12 shrink-0 items-center gap-2 rounded-[12px] bg-[#f6f3ea] px-4 text-sm font-medium text-[#11110f] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Run
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </form>

            <div className="mt-5 space-y-2">
              {AGENT_STEPS.map((step, index) => {
                const Icon = step.icon;
                const StateIcon = step.state === 'ready' ? CheckCircle2 : CircleDashed;
                return (
                  <div key={step.label} className="rounded-[14px] border border-white/[0.06] bg-white/[0.025] p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/[0.08] bg-[#171716] text-[#b9c6ff]">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-[#eee9dd]">{step.label}</p>
                          <StateIcon className={step.state === 'ready' ? 'h-4 w-4 text-emerald-300' : 'h-4 w-4 text-[#77736a]'} aria-hidden="true" />
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[#858177]">{step.detail}</p>
                      </div>
                    </div>
                    {index < AGENT_STEPS.length - 1 && <div className="ml-[17px] mt-2 h-4 w-px bg-white/[0.08]" />}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.aside>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.08 }}
          className="min-h-0 overflow-hidden bg-[radial-gradient(circle_at_40%_0%,rgba(77,110,255,0.16),transparent_32%),#080808] p-4"
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#10100f] shadow-[0_30px_120px_rgba(0,0,0,0.42)]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#858177]">Live report artifact preview</p>
                <p className="mt-1 text-sm text-[#f1ecdf]">No old schema review. No card wizard. Agent writes the report.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#9a958b]">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.8)]" />
                ready
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="border-r border-white/[0.07] bg-[#0c0c0b] p-4">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#77736a]">Specialist agents</p>
                <div className="space-y-2">
                  {SPECIALISTS.map((name, index) => (
                    <div key={name} className="group flex items-center gap-2 rounded-[10px] border border-white/[0.055] bg-white/[0.025] px-3 py-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1b1b19] text-[10px] text-[#9fb1ff]">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-[#d8d2c3]">{name}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-[#5f5b53] transition-colors group-hover:text-[#b7c2ff]" aria-hidden="true" />
                    </div>
                  ))}
                </div>
              </div>

              <article className="min-h-0 overflow-y-auto px-8 py-7">
                <div className="mb-6 flex items-start justify-between gap-6 border-b border-white/[0.07] pb-5">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#7d786e]">GTM intelligence report</p>
                    <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-[-0.035em] text-[#f8f4e8]">
                      Market, ICP, competitors, offer, and demand stitched into one artifact.
                    </h2>
                  </div>
                  <div className="rounded-full border border-white/[0.07] px-3 py-1 text-xs text-[#9b968b]">source-backed</div>
                </div>

                <div className="space-y-6">
                  <section className="border-b border-white/[0.06] pb-5">
                    <div className="mb-2 flex items-center gap-2 text-xs text-[#91a5ff]">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      GTM specialist output
                    </div>
                    <h3 className="text-xl font-medium tracking-[-0.02em] text-[#f4efe2]">Executive verdict</h3>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-[#aaa59a]">
                      AI-GOS will synthesize the strongest GTM angle, cite the evidence that supports it, and call out gaps instead of filling a legacy schema.
                    </p>
                  </section>

                  <section className="grid gap-3 md:grid-cols-3">
                    {['Evidence', 'Risks', 'Moves'].map((label) => (
                      <div key={label} className="rounded-[14px] border border-white/[0.06] bg-white/[0.025] p-4">
                        <p className="text-sm font-medium text-[#ede7da]">{label}</p>
                        <div className="mt-3 space-y-2">
                          <div className="h-2 w-full rounded-full bg-white/[0.08]" />
                          <div className="h-2 w-4/5 rounded-full bg-white/[0.06]" />
                          <div className="h-2 w-2/3 rounded-full bg-white/[0.05]" />
                        </div>
                      </div>
                    ))}
                  </section>
                </div>
              </article>
            </div>
          </div>
        </motion.section>
      </section>
    </main>
  );
}
