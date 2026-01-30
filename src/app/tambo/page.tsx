"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Sparkles, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";

// Dynamically import Tambo components to prevent SSR issues
const TamboProvider = dynamic(
  () => import("@/lib/tambo/provider").then((mod) => mod.TamboProvider),
  { ssr: false }
);

const TamboChat = dynamic(
  () => import("@/components/tambo/tambo-chat").then((mod) => mod.TamboChat),
  { ssr: false, loading: () => <ChatSkeleton /> }
);

function ChatSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground mt-2">Loading Tambo...</p>
    </div>
  );
}

function ApiKeyMissing() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
      <h2 className="text-xl font-semibold mb-2">API Key Required</h2>
      <p className="text-muted-foreground text-center max-w-md mb-4">
        To use Tambo AI, add your API key to <code className="bg-muted px-2 py-1 rounded">.env.local</code>:
      </p>
      <pre className="bg-muted p-4 rounded-lg text-sm">
        NEXT_PUBLIC_TAMBO_API_KEY=your_api_key_here
      </pre>
      <p className="text-sm text-muted-foreground mt-4">
        Get your API key at{" "}
        <a href="https://tambo.co" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          tambo.co
        </a>
      </p>
    </div>
  );
}

function TamboContent() {
  const [mounted, setMounted] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    setMounted(true);
    setHasApiKey(!!process.env.NEXT_PUBLIC_TAMBO_API_KEY);
  }, []);

  if (!mounted) {
    return <ChatSkeleton />;
  }

  if (!hasApiKey) {
    return <ApiKeyMissing />;
  }

  return (
    <TamboProvider>
      <TamboChat />
    </TamboProvider>
  );
}

export default function TamboPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-xl font-semibold">Tambo AI</h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Generative UI Demo
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Chat panel */}
          <Card className="lg:col-span-2 h-[calc(100vh-180px)] flex flex-col">
            <TamboContent />
          </Card>

          {/* Info panel */}
          <div className="space-y-4">
            <Card className="p-6">
              <h2 className="font-semibold mb-3">Available Components</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span><strong>StatCard</strong> - KPIs and metrics</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span><strong>ProgressCard</strong> - Progress tracking</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span><strong>DataChart</strong> - Bar charts</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span><strong>InfoCard</strong> - Information display</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-pink-500" />
                  <span><strong>TaskList</strong> - Interactive checklists</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6">
              <h2 className="font-semibold mb-3">Example Prompts</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>&quot;Show revenue of $125,000 with 12% growth&quot;</li>
                <li>&quot;Display project progress: 7 of 10 tasks done&quot;</li>
                <li>&quot;Create a chart comparing Q1-Q4 sales&quot;</li>
                <li>&quot;Show a success message about deployment&quot;</li>
                <li>&quot;Create a task list for website launch&quot;</li>
              </ul>
            </Card>

            <Card className="p-6 bg-primary/5 border-primary/20">
              <h2 className="font-semibold mb-2">How it works</h2>
              <p className="text-sm text-muted-foreground">
                Tambo AI analyzes your natural language request and automatically
                selects the best component to display. Components are registered
                with Zod schemas that define their props.
              </p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
