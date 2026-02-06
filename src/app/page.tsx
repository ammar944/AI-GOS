import Link from "next/link";
import { ArrowRight, Timer, BarChart3, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlobBackground } from "@/components/ui/blob-background";
import { GradientText } from "@/components/ui/gradient-text";
import { Logo } from "@/components/ui/logo";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="relative z-50 border-b border-border/60 bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Logo size="md" />
          </Link>
          <Link href="/sign-in">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-border/60 bg-white/[0.04] text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-primary hover:text-white hover:bg-primary/10"
            >
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <BlobBackground preset="hero" showGrid className="relative flex-1 flex items-center justify-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[680px] bg-[radial-gradient(ellipse_50%_50%_at_50%_0%,rgba(54,94,255,0.2),transparent_70%)] opacity-40" />
        <main className="container mx-auto px-4 py-20 text-center">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-primary/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-primary mb-8 animate-fade-scale"
            style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}
          >
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="text-muted-foreground">AI</span>
            <span className="text-muted-foreground/60">·</span>
            <span>Powered Marketing Intelligence</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl font-bold tracking-[-0.04em] sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl mx-auto animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
            <span className="text-white">Launch Your </span>
            <GradientText variant="hero" as="span" className="font-bold">
              SaaS Marketing
            </GradientText>
            <span className="text-white block mt-2">With AI Precision</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-[1.7] tracking-[-0.02em] animate-slide-up" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
            Generate comprehensive Strategic Research Blueprints with platform
            recommendations, budget allocation, funnel strategies, and KPI targets
            in under{" "}
            <span className="text-primary font-semibold">60 seconds</span>.
          </p>

          {/* CTA Button */}
          <div className="mt-10 animate-slide-up" style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}>
            <Link href="/generate">
              <Button
                size="lg"
                className="group rounded-full border border-white/10 bg-gradient-to-br from-[rgb(54,94,255)] to-[rgb(0,111,255)] text-white shadow-[0_16px_40px_rgba(54,94,255,0.25),inset_0_1px_0_rgba(255,255,255,0.18)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(54,94,255,0.35),inset_0_1px_0_rgba(255,255,255,0.22)]"
              >
                Generate Strategic Research
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </div>

          {/* Features - Clean inline */}
          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              {
                icon: Timer,
                title: "Lightning Fast",
                detail: "60s",
              },
              {
                icon: BarChart3,
                title: "Strategic",
                detail: "Data-driven",
              },
              {
                icon: Layers,
                title: "Full Funnel",
                detail: "End-to-end",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group flex items-center gap-4 rounded-[14px] border border-border/60 bg-[rgba(12,14,19,0.6)] px-5 py-4 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.8)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]"
              >
                <div className="flex items-center justify-center size-10 rounded-[10px] border border-border/60 bg-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <item.icon className="size-[18px] text-primary" />
                </div>
                <div className="leading-tight">
                  <div className="text-[13px] font-medium tracking-[-0.01em] text-white">
                    {item.title}
                  </div>
                  <div className="mt-1 text-[12px] text-muted-foreground">
                    {item.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </BlobBackground>

      {/* Footer */}
      <footer className="relative z-50 border-t border-border/60 bg-background">
        <div className="container mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <p className="text-xs text-muted-foreground">
            © 2026 SaaSLaunch. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
