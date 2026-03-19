import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Ambient mesh glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* Primary blue — top center */}
        <div
          className="absolute w-[900px] h-[600px] -top-[15%] left-1/2 -translate-x-1/2 rounded-full aurora-glow"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(54,94,255,0.14) 0%, transparent 65%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Cyan accent — upper right */}
        <div
          className="absolute w-[400px] h-[350px] top-[10%] right-[8%] rounded-full aurora-glow-delayed"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(80,248,228,0.06) 0%, transparent 65%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Purple accent — lower left */}
        <div
          className="absolute w-[350px] h-[300px] bottom-[15%] left-[10%] rounded-full aurora-glow-slow"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(167,139,250,0.05) 0%, transparent 65%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* Nav */}
      <header className="relative z-50">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Logo size="md" />
          </Link>
          <Link href="/sign-in">
            <Button
              size="sm"
              className="cursor-pointer rounded-full bg-foreground text-background text-[13px] font-semibold px-5 h-9 transition-all hover:bg-foreground/90 hover:shadow-md"
            >
              Sign In
            </Button>
          </Link>
        </div>
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex items-center justify-center">
        <div className="mx-auto max-w-[1200px] px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--accent-blue)]/25 bg-[var(--accent-blue)]/[0.08] px-5 py-2 mb-10 animate-in fade-in slide-in-from-bottom-2 duration-700 fill-mode-backwards shadow-[0_0_20px_rgba(54,94,255,0.08)]">
            <span className="size-2 rounded-full bg-[var(--accent-blue)] shadow-[0_0_6px_var(--accent-blue)]" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-blue)]">
              AI-Powered Marketing Intelligence
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-heading text-4xl font-bold tracking-[-0.04em] text-[var(--text-primary)] sm:text-5xl md:text-6xl lg:text-7xl animate-in fade-in slide-in-from-bottom-3 duration-700 delay-100 fill-mode-backwards">
            Your paid media
            <br />
            <span className="text-[var(--accent-blue)]">command center.</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-[16px] md:text-[17px] text-[var(--text-secondary)] max-w-md mx-auto leading-[1.7] animate-in fade-in slide-in-from-bottom-3 duration-700 delay-200 fill-mode-backwards">
            Drop a URL. AIGOS runs market research, maps your
            competitors, and builds a full paid media blueprint.
          </p>

          {/* CTA */}
          <div className="mt-10 animate-in fade-in slide-in-from-bottom-3 duration-700 delay-300 fill-mode-backwards">
            <Link href="/journey">
              <Button
                size="lg"
                className="cursor-pointer group h-12 rounded-full bg-foreground text-background font-semibold text-[15px] px-8 shadow-sm transition-all duration-200 hover:bg-foreground/90 hover:shadow-lg"
              >
                Start Journey
                <ArrowRight className="ml-1.5 size-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* No footer — single clean viewport */}
    </div>
  );
}
