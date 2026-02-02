import Link from "next/link";
import { ArrowRight, Sparkles, Zap, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlobBackground } from "@/components/ui/blob-background";
import { GradientText } from "@/components/ui/gradient-text";
import { Logo } from "@/components/ui/logo";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="relative z-50 border-b border-border/40">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Logo size="md" />
          </Link>
          <Link href="/sign-in">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <BlobBackground preset="hero" showGrid className="flex-1 flex items-center justify-center">
        <main className="container mx-auto px-4 py-20 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-8 animate-fade-scale" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
            <span className="size-1.5 rounded-full bg-primary" />
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
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-up" style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}>
            <Link href="/generate">
              <Button size="lg" className="group bg-primary text-white hover:bg-primary/90">
                Generate Media Plan
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link href="/media-plan">
              <Button variant="ghost" size="lg" className="text-muted-foreground hover:text-white">
                Quick Plan
              </Button>
            </Link>
          </div>

          {/* Trust indicator */}
          <p className="mt-6 text-sm text-muted-foreground animate-fade-scale" style={{ animationDelay: '500ms', animationFillMode: 'backwards' }}>
            No account required to get started
          </p>

          {/* Features Grid - Miana-style cards */}
          <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card variant="glass" hover="glow" className="animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
              <CardContent className="p-6 space-y-4">
                <div className="text-primary">
                  <Zap className="size-5" strokeWidth={1.5} />
                </div>
                <h3 className="font-medium text-white">Lightning Fast</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Get comprehensive media plans in under a minute, powered by advanced AI models.
                </p>
              </CardContent>
            </Card>

            <Card variant="glass" hover="glow" className="animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
              <CardContent className="p-6 space-y-4">
                <div className="text-primary">
                  <Target className="size-5" strokeWidth={1.5} />
                </div>
                <h3 className="font-medium text-white">Strategic Insights</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Data-driven recommendations for platform selection, budget allocation, and targeting.
                </p>
              </CardContent>
            </Card>

            <Card variant="glass" hover="glow" className="animate-slide-up" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
              <CardContent className="p-6 space-y-4">
                <div className="text-primary">
                  <Sparkles className="size-5" strokeWidth={1.5} />
                </div>
                <h3 className="font-medium text-white">Full Funnel Coverage</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  From awareness to conversion, get strategies tailored to every stage of the customer journey.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </BlobBackground>

      {/* Footer */}
      <footer className="relative z-50 border-t border-border/40">
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
