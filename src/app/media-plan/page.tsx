import Link from "next/link";
import { FormWizard } from "@/components/media-plan/form-wizard";
import { BlobBackground } from "@/components/ui/blob-background";
import { GradientText } from "@/components/ui/gradient-text";
import { Logo } from "@/components/ui/logo";

export const metadata = {
  title: "Media Plan Generator | SaaSLaunch",
  description: "Generate a Strategic Research Blueprint for your marketing campaigns with AI-powered insights.",
};

export default function MediaPlanPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="relative z-50 border-b border-border/50 backdrop-blur-sm bg-background/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Logo size="md" />
          </Link>
          <span className="text-sm text-muted-foreground">
            Media Plan Generator
          </span>
        </div>
      </header>

      {/* Main Content */}
      <BlobBackground preset="subtle" className="flex-1">
        <main className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              <span className="text-white">Strategic Research </span>
              <GradientText variant="hero" as="span" className="font-bold">
                Blueprint
              </GradientText>
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              Generate a comprehensive media plan with platform recommendations,
              budget allocation, funnel strategy, and KPI targets powered by AI.
            </p>
          </div>

          <FormWizard />
        </main>
      </BlobBackground>

      {/* Footer */}
      <footer className="relative z-50 border-t border-border/50 bg-background/80 backdrop-blur-sm mt-auto">
        <div className="container mx-auto px-4 py-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Powered by</span>
            <Logo size="sm" />
          </div>
        </div>
      </footer>
    </div>
  );
}
