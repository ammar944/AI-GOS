'use client';

import Link from 'next/link';

export interface JourneyManusWelcomeProps {
  websiteUrl: string;
  linkedinUrl: string;
  onWebsiteUrlChange: (value: string) => void;
  onLinkedinUrlChange: (value: string) => void;
  onAnalyze: () => void;
  onSkip: () => void;
}

const LANDING_NAV_ITEMS = [
  { href: '/journey', label: 'Journey' },
  { href: '/blueprints', label: 'Blueprints' },
  { href: '/dashboard', label: 'Dashboard' },
];

const WELCOME_STARTER_CARDS = [
  {
    eyebrow: 'B2B SaaS landing page',
    title: 'Turn a homepage into a paid acquisition brief',
    description:
      'Ideal for products that need market context, competitor mapping, and a cleaner media-plan starting point.',
    accentFrom: '#d6c4a8',
    accentTo: '#f4efe7',
  },
  {
    eyebrow: 'Competitor intel',
    title: 'Pressure-test positioning against the category leaders',
    description:
      'Best when you already know the market and need sharper positioning, hooks, and proof points.',
    accentFrom: '#c9d8f4',
    accentTo: '#f4f2ee',
  },
  {
    eyebrow: 'Offer audit',
    title: 'Stress-test the pricing and offer stack before spend',
    description:
      'Useful when the homepage is live but conversion confidence is low and the offer needs tightening.',
    accentFrom: '#d5e5d8',
    accentTo: '#f5f2eb',
  },
  {
    eyebrow: 'ICP framing',
    title: 'Clarify the buyer before the research wave begins',
    description:
      'For teams with traffic but weak message-market fit who need Journey to anchor on the right audience.',
    accentFrom: '#e7d9c8',
    accentTo: '#f5efe7',
  },
];

function JourneyStarterCard({
  eyebrow,
  title,
  description,
  accentFrom,
  accentTo,
}: {
  eyebrow: string;
  title: string;
  description: string;
  accentFrom: string;
  accentTo: string;
}): React.JSX.Element {
  return (
    <div className="paper-surface group flex items-center gap-4 rounded-[22px] p-4 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#878279]">
          {eyebrow}
        </p>
        <h3 className="mt-2 text-[15px] font-medium leading-6 text-[#1f1d18]">
          {title}
        </h3>
        <p className="mt-2 text-[13px] leading-6 text-[#6d685f]">
          {description}
        </p>
      </div>
      <div
        className="relative hidden h-[84px] w-[104px] overflow-hidden rounded-[18px] border border-black/6 bg-white md:block"
        style={{
          background: `linear-gradient(145deg, ${accentFrom}, ${accentTo})`,
        }}
      >
        <div className="absolute inset-x-3 top-3 h-3 rounded-full bg-white/85" />
        <div className="absolute inset-x-3 top-8 h-9 rounded-[14px] bg-white/80 shadow-[0_10px_25px_rgba(17,16,13,0.06)]" />
        <div className="absolute bottom-3 left-3 h-6 w-6 rounded-[10px] bg-white/85" />
        <div className="absolute bottom-3 right-3 h-6 w-10 rounded-[10px] bg-white/72" />
      </div>
    </div>
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
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f5f1] text-[#1f1d18]">
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
            {LANDING_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-[#1f1d18]"
              >
                {item.label}
              </Link>
            ))}
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
        Journey now coordinates research waves, approvals, and synthesis in one workspace.
      </div>

      <main className="flex-1 overflow-y-auto px-6 pb-24 pt-14 lg:px-8">
        <div className="mx-auto max-w-[1180px]">
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#8a867d]">
              Strategy Intake
            </p>
            <h1
              className="mx-auto mt-6 max-w-4xl text-[3.35rem] leading-[1.02] tracking-[-0.04em] text-[#1f1d18] sm:text-[4.6rem]"
              style={{
                fontFamily:
                  'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
              }}
            >
              What should we build toward?
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-[#6b675f]">
              Drop in the homepage and Journey will turn it into a research-ready brief:
              market context, competitors, ICP validation, offer analysis, and the first paid
              media direction.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-3xl rounded-[28px] border border-black/8 bg-white p-5 shadow-[0_24px_70px_rgba(17,16,13,0.08)]">
            <div className="rounded-[22px] border border-black/8 bg-[#fbfaf7] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[#8a867d]">
                Company website
              </label>
              <div className="mt-3 flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/8 bg-white text-[18px] text-[#6b675f]">
                  +
                </span>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(event) => onWebsiteUrlChange(event.target.value)}
                  placeholder="https://your-company.com"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-[#1f1d18] placeholder:text-[#aaa59b] focus:outline-none"
                />
                <div className="hidden items-center gap-2 md:flex">
                  <span className="rounded-full border border-[#c7dafd] bg-[#eef4ff] px-3 py-1 text-[11px] text-[#356af8]">
                    Journey
                  </span>
                  <span className="rounded-full border border-black/6 bg-white px-3 py-1 text-[11px] text-[#716c63]">
                    Research ready
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onAnalyze}
                  disabled={!websiteUrl.trim()}
                  aria-label="Analyze website"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1f1d18] text-white transition-opacity hover:opacity-90 disabled:opacity-30"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M5 12h14m-7-7 7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="mt-4 rounded-[18px] border border-black/6 bg-white px-4 py-3">
                <label className="text-[11px] uppercase tracking-[0.18em] text-[#8a867d]">
                  LinkedIn company page (optional)
                </label>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(event) => onLinkedinUrlChange(event.target.value)}
                  placeholder="https://linkedin.com/company/your-company"
                  className="mt-2 w-full bg-transparent text-[14px] text-[#1f1d18] placeholder:text-[#aaa59b] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[13px] text-[#5f5b54]">
                  Start with a website for the cleanest research handoff.
                </p>
                <p className="mt-1 text-[12px] text-[#8a867d]">
                  No forms. Journey will collect the rest contextually as the research progresses.
                </p>
              </div>
              <button
                type="button"
                onClick={onSkip}
                className="rounded-full border border-black/8 px-4 py-2 text-[12px] text-[#625f57] transition-colors hover:border-black/14 hover:text-[#1f1d18]"
              >
                Start without website analysis
              </button>
            </div>
          </div>

          <div className="mx-auto mt-10 max-w-4xl">
            <p className="mb-4 text-[14px] text-[#625f57]">
              Get started with
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {WELCOME_STARTER_CARDS.map((card) => (
                <JourneyStarterCard
                  key={card.title}
                  eyebrow={card.eyebrow}
                  title={card.title}
                  description={card.description}
                  accentFrom={card.accentFrom}
                  accentTo={card.accentTo}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
