'use client';

import { JourneyChatInput } from '@/components/journey/chat-input';

interface JourneyWelcomeViewProps {
  onSubmit: (content: string) => void;
  isLoading: boolean;
}

/**
 * Static welcome view that renders a pixel-perfect replica of the
 * journey-v2-mockup.html design. Shown as the initial state before
 * the user starts a journey.
 */
export function JourneyWelcomeView({ onSubmit, isLoading }: JourneyWelcomeViewProps) {
  return (
    <>
      {/* Minimal Stepper */}
      <div className="flex justify-center gap-12 py-8 flex-none" data-purpose="stepper">
        <div className="flex flex-col items-center gap-2 group cursor-default">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-success ring-4 ring-brand-success/20" />
          <span className="text-[10px] uppercase tracking-widest text-brand-success font-semibold">Discovery</span>
        </div>
        <div className="flex flex-col items-center gap-2 opacity-100">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-accent animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest text-brand-accent font-semibold">Validation</span>
        </div>
        <div className="flex flex-col items-center gap-2 opacity-30">
          <div className="w-2.5 h-2.5 rounded-full bg-white/50" />
          <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Strategy</span>
        </div>
        <div className="flex flex-col items-center gap-2 opacity-30">
          <div className="w-2.5 h-2.5 rounded-full bg-white/50" />
          <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Launch</span>
        </div>
      </div>

      {/* Content Stream */}
      <section className="flex-1 overflow-y-auto custom-scrollbar px-12 pb-32 space-y-12">
        {/* Chat Area Message */}
        <div className="max-w-3xl mx-auto text-center space-y-4" data-purpose="message-user">
          <h2 className="text-3xl font-light text-white/90">
            Initialize a performance-driven market analysis for{' '}
            <span className="text-brand-accent">SaaS Infrastructure</span>.
          </h2>
          <p className="text-white/40 text-sm">Targeting Series A startups in North America.</p>
        </div>

        {/* Research Grid */}
        <div className="grid grid-cols-2 gap-6 max-w-5xl mx-auto" data-purpose="research-cards">
          {/* Card: Market Overview */}
          <div className="glass-surface p-6 rounded-module relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono text-white/40 uppercase tracking-tighter">Module 01</span>
              <div className="w-2 h-2 rounded-full bg-brand-success shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            </div>
            <h3 className="text-lg font-medium mb-2">Market Overview</h3>
            <p className="text-sm text-white/50 leading-relaxed mb-4">
              Identified 4.2k potential entry points within the cloud infrastructure vertical.
            </p>
            <div className="space-y-1 text-[11px] font-mono text-white/30">
              <div className="flex justify-between"><span>TAM:</span> <span>$14.2B</span></div>
              <div className="flex justify-between"><span>CAGR:</span> <span>18.4%</span></div>
            </div>
          </div>

          {/* Card: Competitor Intel (Active) */}
          <div className="glass-surface p-6 rounded-module border-brand-accent/30 bg-brand-accent/[0.01]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono text-brand-accent uppercase tracking-tighter">Module 02</span>
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-brand-accent animate-subtle-pulse" />
                <div className="w-1 h-1 rounded-full bg-brand-accent animate-subtle-pulse" style={{ animationDelay: '75ms' }} />
                <div className="w-1 h-1 rounded-full bg-brand-accent animate-subtle-pulse" style={{ animationDelay: '150ms' }} />
              </div>
            </div>
            <h3 className="text-lg font-medium mb-2 text-brand-accent">Competitor Intel</h3>
            <p className="text-sm text-white/70 leading-relaxed">Scraping G2 reviews and pricing pages for direct competitors...</p>
            <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="bg-brand-accent h-full w-[45%]" />
            </div>
          </div>
        </div>

        {/* Technical Data Stream */}
        <div className="max-w-5xl mx-auto" data-purpose="technical-stream">
          <div className="glass-surface rounded-module p-6 font-mono text-[11px] text-white/40 space-y-1 bg-black/40">
            <p><span className="text-brand-success">[OK]</span> Connection established to LinkedIn Sales Navigator API</p>
            <p><span className="text-brand-accent">[RUN]</span> Scanning 850 profiles for Ideal Customer Persona match</p>
            <p><span className="text-white/20">[INF]</span> Found signal: &quot;Kubernetes cost optimization&quot; mentioned in 42 recent posts</p>
            <p><span className="text-white/20">[INF]</span> Mapping decision makers at: Vercel, HashiCorp, Supabase</p>
            <p><span className="text-brand-accent animate-pulse">_</span></p>
          </div>
        </div>

        {/* AI Response (Chat Style) */}
        <div className="max-w-3xl mx-auto pl-6 border-l-2 border-brand-accent/40 py-2" data-purpose="ai-response">
          <p className="text-white/80 leading-relaxed font-light text-lg">
            &ldquo;I&rsquo;ve identified a significant gap in mid-market serverless monitoring. While Enterprise tools exist, Series A startups are currently overpaying for features they don&rsquo;t use. I recommend focusing our first blueprint on &lsquo;Lean Infrastructure Observability&rsquo;.&rdquo;
          </p>
        </div>

        {/* Profile Card: What I know */}
        <div className="max-w-5xl mx-auto glass-surface rounded-module p-8" data-purpose="summary-grid">
          <h4 className="text-xs font-mono text-white/30 uppercase tracking-widest mb-6">Profile Snapshot: Project Alpha</h4>
          <div className="grid grid-cols-3 gap-8">
            <div>
              <p className="text-[10px] text-white/30 uppercase mb-2">Primary ICP</p>
              <p className="text-sm font-medium">DevOps Leads @ Series A</p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase mb-2">Pain Point</p>
              <p className="text-sm font-medium">Cloud Cost Attribution</p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase mb-2">Active Channels</p>
              <p className="text-sm font-medium">LinkedIn, Twitter, Reddit</p>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Input Bar */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center px-12 pointer-events-none">
        <JourneyChatInput
          onSubmit={onSubmit}
          isLoading={isLoading}
          placeholder="Ask AIGOS to refine the strategy..."
        />
      </div>
    </>
  );
}
