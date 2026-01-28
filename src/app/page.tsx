import Link from "next/link";
import { ArrowRight, Sparkles, Zap, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlobBackground } from "@/components/ui/blob-background";
import { GradientText } from "@/components/ui/gradient-text";
import { Logo } from "@/components/ui/logo";
import { GlowCard, GlowCardContent } from "@/components/ui/glow-card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="relative z-50 border-b border-border/50 backdrop-blur-sm bg-background/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Logo size="md" />
          </Link>
          <Link href="/sign-in">
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <BlobBackground preset="hero" showGrid className="flex-1 flex items-center justify-center">
        <main className="container mx-auto px-4 py-20 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-8">
            <Sparkles className="size-4" />
            <span>AI-Powered Marketing Intelligence</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl mx-auto">
            <span className="text-white">Launch Your </span>
            <GradientText variant="hero" as="span" className="font-bold">
              SaaS Marketing
            </GradientText>
            <span className="text-white block mt-2">With AI Precision</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Generate comprehensive Strategic Research Blueprints with platform
            recommendations, budget allocation, funnel strategies, and KPI targets
            in under{" "}
            <span className="text-primary font-semibold">60 seconds</span>.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/generate">
              <Button variant="gradient" size="xl" className="group">
                Generate Media Plan
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/media-plan">
              <Button variant="outline" size="lg">
                Quick Plan
              </Button>
            </Link>
          </div>

          {/* Trust indicator */}
          <p className="mt-6 text-sm text-muted-foreground">
            No account required to get started
          </p>

          {/* Features Grid */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <GlowCard variant="glass" glow="sm" className="p-6 text-left">
              <GlowCardContent className="p-0">
                <div className="inline-flex items-center justify-center size-12 rounded-lg bg-primary/20 text-primary mb-4">
                  <Zap className="size-6" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Lightning Fast</h3>
                <p className="text-sm text-muted-foreground">
                  Get comprehensive media plans in under a minute, powered by advanced AI models.
                </p>
              </GlowCardContent>
            </GlowCard>

            <GlowCard variant="glass" glow="sm" className="p-6 text-left">
              <GlowCardContent className="p-0">
                <div className="inline-flex items-center justify-center size-12 rounded-lg bg-primary/20 text-primary mb-4">
                  <Target className="size-6" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Strategic Insights</h3>
                <p className="text-sm text-muted-foreground">
                  Data-driven recommendations for platform selection, budget allocation, and targeting.
                </p>
              </GlowCardContent>
            </GlowCard>

            <GlowCard variant="glass" glow="sm" className="p-6 text-left">
              <GlowCardContent className="p-0">
                <div className="inline-flex items-center justify-center size-12 rounded-lg bg-primary/20 text-primary mb-4">
                  <Sparkles className="size-6" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Full Funnel Coverage</h3>
                <p className="text-sm text-muted-foreground">
                  From awareness to conversion, get strategies tailored to every stage of the customer journey.
                </p>
              </GlowCardContent>
            </GlowCard>
          </div>
        </main>
      </BlobBackground>

      {/* Footer */}
      <footer className="relative z-50 border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="text-sm text-muted-foreground">
              - Go-to-Market Operations System
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Powered by AI
          </p>
        </div>
      </footer>
    </div>
  );
}
