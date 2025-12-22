import { FormWizard } from "@/components/media-plan/form-wizard";

export const metadata = {
  title: "Media Plan Generator | AI-GOS",
  description: "Generate a Strategic Research Blueprint for your marketing campaigns",
};

export default function MediaPlanPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <a href="/" className="text-xl font-bold">
            AI-GOS
          </a>
          <span className="text-sm text-muted-foreground">
            Media Plan Generator
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Strategic Research Blueprint
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Generate a comprehensive media plan with platform recommendations,
            budget allocation, funnel strategy, and KPI targets powered by AI.
          </p>
        </div>

        <FormWizard />
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          Powered by AI-GOS
        </div>
      </footer>
    </div>
  );
}
