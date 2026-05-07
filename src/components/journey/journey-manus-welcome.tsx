'use client';

import { useRef, type ElementType } from 'react';
import {
  AlertCircle,
  Code,
  Database,
  FileSearch,
  FileText,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

export interface JourneyManusWelcomeProps {
  websiteUrl: string;
  onWebsiteUrlChange: (value: string) => void;
  onAnalyze: () => void;
  linkedinUrl?: string;
  onLinkedinUrlChange?: (value: string) => void;
  onSkip?: () => void;
}

interface SuggestionChip {
  label: string;
  Icon: ElementType;
}

interface ActionPill {
  label: string;
}

const SUGGESTION_CHIPS: SuggestionChip[] = [
  { label: 'Show source trail', Icon: FileSearch },
  { label: 'Go deeper on competitors', Icon: Search },
  { label: 'Rewrite positioning', Icon: Code },
  { label: 'Find unsupported claims', Icon: AlertCircle },
];

const ACTION_PILLS: ActionPill[] = [
  { label: '+ Source' },
  { label: 'Deep Research' },
  { label: 'Corpus' },
  { label: 'Synthesis' },
];

function JourneyIconRail(): React.JSX.Element {
  return (
    <aside className="hidden w-16 shrink-0 flex-col items-center gap-4 border-r border-[#0d1018] bg-[#0a0d14] py-4 md:flex">
      <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#365eff]">
        <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#0d1018] text-[#8e97a6] transition-colors hover:bg-[#14171f]">
        <Database className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#0d1018] text-[#8e97a6] transition-colors hover:bg-[#14171f]">
        <FileText className="h-5 w-5" aria-hidden="true" />
      </div>
    </aside>
  );
}

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
    <div className="flex min-h-screen bg-[#06080d] text-[#fcfcfa]">
      <JourneyIconRail />

      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#0d1018] bg-[#0a0d14] px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[#365eff] md:hidden">
              <Sparkles className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-medium text-[#fcfcfa]">
                AI-GOS Journey
              </h1>
              <p className="truncate text-xs text-[#8e97a6]">
                deep research to GTM workspace
              </p>
            </div>
          </div>

          <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[#365eff]/20 bg-[#365eff]/10 px-3 text-xs font-medium text-[#8faaff]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#50f8e4]" />
            agent ready
          </span>
        </header>

        <section className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-[860px] flex-col items-center justify-center px-6 py-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="mb-12 text-center"
            >
              <h2 className="mb-4 text-4xl font-light leading-tight text-[#fcfcfa]">
                Ask for research. Watch AI-GOS write the report.
              </h2>
              <p className="mx-auto max-w-2xl text-sm leading-6 text-[#8e97a6]">
                Drop a company URL and AI-GOS will build the evidence corpus,
                extract the profile context, then open the Journey workspace for
                section-by-section GTM synthesis.
              </p>
            </motion.div>

            <div className="mb-8 flex flex-wrap justify-center gap-3">
              {SUGGESTION_CHIPS.map(({ label, Icon }, index) => (
                <motion.button
                  key={label}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  onClick={() => inputRef.current?.focus()}
                  className="flex items-center gap-2 rounded-full border border-[#14171f] bg-[#0d1018] px-4 py-2 text-sm text-[#fcfcfa] transition-colors hover:border-[#365eff]/35 hover:bg-[#14171f]"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </motion.button>
              ))}
            </div>
          </div>
        </section>

        <footer className="shrink-0 border-t border-[#0d1018] bg-[#0a0d14] p-4 sm:p-6">
          <form
            className="mx-auto max-w-[860px] overflow-hidden rounded-[8px] border border-[#14171f] bg-[#0d1018] shadow-[0_24px_80px_rgba(0,0,0,0.32)]"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label htmlFor="journey-company-url" className="sr-only">
              Company URL
            </label>
            <div className="p-4">
              <input
                ref={inputRef}
                id="journey-company-url"
                type="text"
                value={websiteUrl}
                onChange={(event) => onWebsiteUrlChange(event.target.value)}
                placeholder="Drop a company URL to start deep research"
                className="w-full bg-transparent text-base text-[#fcfcfa] outline-none placeholder:text-[#8e97a6]"
              />
            </div>
            <div className="flex flex-col gap-3 px-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {ACTION_PILLS.map((pill) => (
                  <span
                    key={pill.label}
                    className={cn(
                      'rounded-full border border-[#1e2129] bg-[#14171f] px-3 py-1.5 text-xs text-[#fcfcfa]',
                      pill.label === 'Deep Research' && 'border-[#365eff]/35 text-[#8faaff]',
                    )}
                  >
                    {pill.label}
                  </span>
                ))}
              </div>
              <button
                type="submit"
                disabled={!canAnalyze}
                aria-label="Start deep research"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#365eff] text-white transition-colors hover:bg-[#006fff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        </footer>
      </main>
    </div>
  );
}
