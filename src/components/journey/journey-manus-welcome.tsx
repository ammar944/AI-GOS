'use client';

import { useRef } from 'react';
import { Send } from 'lucide-react';
import { motion } from 'framer-motion';

export interface JourneyManusWelcomeProps {
  websiteUrl: string;
  onWebsiteUrlChange: (value: string) => void;
  onAnalyze: () => void;
  linkedinUrl?: string;
  onLinkedinUrlChange?: (value: string) => void;
  onSkip?: () => void;
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
    <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[#06080d] text-[#fcfcfa]">
      <section className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[860px] flex-col items-center justify-center px-6 py-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="w-full text-center"
            >
              <h2 className="mb-4 text-4xl font-light leading-tight text-[#fcfcfa]">
                Ask for research. Watch AI-GOS write the report.
              </h2>
              <p className="mx-auto mb-8 max-w-2xl text-sm leading-6 text-[#8e97a6]">
                Drop a company URL and AI-GOS will build the evidence corpus,
                extract the profile context, then open the GTM command view for
                section-by-section synthesis.
              </p>

              <form
                className="mx-auto flex max-w-2xl items-center gap-3 overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#111110] p-2 text-left shadow-[0_24px_80px_rgba(0,0,0,0.34)]"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
              >
                <label htmlFor="journey-company-url" className="sr-only">
                  Company URL
                </label>
                <input
                  ref={inputRef}
                  id="journey-company-url"
                  type="text"
                  value={websiteUrl}
                  onChange={(event) => onWebsiteUrlChange(event.target.value)}
                  placeholder="Paste website URL…"
                  className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base text-[#fcfcfa] outline-none placeholder:text-[#8e97a6]"
                />
                <button
                  type="submit"
                  disabled={!canAnalyze}
                  aria-label="Start deep research"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-[#365eff] text-white transition-colors hover:bg-[#006fff] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>
            </motion.div>
        </div>
      </section>
    </main>
  );
}
