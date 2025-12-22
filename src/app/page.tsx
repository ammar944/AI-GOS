import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <span className="text-xl font-bold">AI-GOS</span>
          <Link href="/login">
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            AI-Powered
            <span className="text-primary block mt-2">Media Planning</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Generate comprehensive Strategic Research Blueprints with platform
            recommendations, budget allocation, funnel strategies, and KPI targets
            in under 60 seconds.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/media-plan">
              <Button size="lg" className="text-lg px-8">
                Generate Media Plan
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            No account required for MVP
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          AI-GOS - Go-to-Market Operations System
        </div>
      </footer>
    </div>
  );
}
