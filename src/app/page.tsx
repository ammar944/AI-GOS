import Link from "next/link";
import { ArrowRight, Sparkles, Zap, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlobBackground } from "@/components/ui/blob-background";
import { GradientText } from "@/components/ui/gradient-text";
import { Logo } from "@/components/ui/logo";
// GlowCard available but using custom cards for homepage features

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="relative z-50 border-b border-primary/20 backdrop-blur-xl bg-[oklch(0.12_0.03_265_/_0.7)] shadow-[0_1px_20px_oklch(0.62_0.19_255_/_0.1)]">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Logo size="md" />
          </Link>
          <Link href="/sign-in">
            <Button variant="outline" size="sm" className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <BlobBackground preset="hero" showGrid className="flex-1 flex items-center justify-center">
        <main className="container mx-auto px-4 py-20 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-8 animate-fade-scale" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
            <Sparkles className="size-4" />
            <span>AI-Powered Marketing Intelligence</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl mx-auto animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
            <span className="text-white">Launch Your </span>
            <GradientText variant="hero" as="span" className="font-bold">
              SaaS Marketing
            </GradientText>
            <span className="text-white block mt-2">With AI Precision</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
            Generate comprehensive Strategic Research Blueprints with platform
            recommendations, budget allocation, funnel strategies, and KPI targets
            in under{" "}
            <span className="text-primary font-semibold">60 seconds</span>.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}>
            <Link href="/generate">
              <Button variant="gradient" size="xl" className="group shadow-[0_0_40px_oklch(0.62_0.19_255_/_0.4)] hover:shadow-[0_0_50px_oklch(0.62_0.19_255_/_0.5)]">
                Generate Media Plan
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/media-plan">
              <Button variant="outline" size="lg" className="border-primary/30 bg-[oklch(0.15_0.03_265_/_0.5)] text-white hover:bg-[oklch(0.18_0.04_265_/_0.6)] hover:border-primary/50 backdrop-blur-sm">
                Quick Plan
              </Button>
            </Link>
          </div>

          {/* Trust indicator */}
          <p className="mt-6 text-sm text-muted-foreground animate-fade-scale" style={{ animationDelay: '500ms', animationFillMode: 'backwards' }}>
            No account required to get started
          </p>

          {/* Features Grid */}
          <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Card 1 */}
            <div className="group relative animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
              {/* Gradient border wrapper */}
              <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-primary/50 via-primary/20 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative p-8 rounded-2xl bg-gradient-to-b from-[oklch(0.16_0.03_265)] to-[oklch(0.12_0.02_265)] backdrop-blur-xl h-full transition-transform duration-200 group-hover:scale-[1.02]">
                {/* Inner glow */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <div className="inline-flex items-center justify-center size-14 rounded-xl bg-gradient-to-br from-primary/40 to-primary/10 text-primary mb-5 shadow-[0_0_20px_oklch(0.62_0.19_255_/_0.3)]">
                    <Zap className="size-7" />
                  </div>
                  <h3 className="font-semibold text-xl mb-3 text-white">Lightning Fast</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Get comprehensive media plans in under a minute, powered by advanced AI models.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="group relative animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
              <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-primary/50 via-primary/20 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative p-8 rounded-2xl bg-gradient-to-b from-[oklch(0.16_0.03_265)] to-[oklch(0.12_0.02_265)] backdrop-blur-xl h-full transition-transform duration-200 group-hover:scale-[1.02]">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <div className="inline-flex items-center justify-center size-14 rounded-xl bg-gradient-to-br from-primary/40 to-primary/10 text-primary mb-5 shadow-[0_0_20px_oklch(0.62_0.19_255_/_0.3)]">
                    <Target className="size-7" />
                  </div>
                  <h3 className="font-semibold text-xl mb-3 text-white">Strategic Insights</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Data-driven recommendations for platform selection, budget allocation, and targeting.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="group relative animate-slide-up" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
              <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-primary/50 via-primary/20 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative p-8 rounded-2xl bg-gradient-to-b from-[oklch(0.16_0.03_265)] to-[oklch(0.12_0.02_265)] backdrop-blur-xl h-full transition-transform duration-200 group-hover:scale-[1.02]">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <div className="inline-flex items-center justify-center size-14 rounded-xl bg-gradient-to-br from-primary/40 to-primary/10 text-primary mb-5 shadow-[0_0_20px_oklch(0.62_0.19_255_/_0.3)]">
                    <Sparkles className="size-7" />
                  </div>
                  <h3 className="font-semibold text-xl mb-3 text-white">Full Funnel Coverage</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    From awareness to conversion, get strategies tailored to every stage of the customer journey.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </BlobBackground>

      {/* Footer */}
      <footer className="relative z-50 border-t border-primary/10 bg-background/90 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
          </div>
          <p className="text-sm text-muted-foreground">
            AI-Powered Marketing Intelligence
          </p>
        </div>
      </footer>
    </div>
  );
}
