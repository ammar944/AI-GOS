/**
 * GenerateHeader Examples
 *
 * This file demonstrates the GenerateHeader component in various states.
 * Use this as a reference for integration or create a route at /examples/generate-header
 * to view these examples in the browser.
 */

"use client";

import * as React from "react";
import { GenerateHeader, type GenerateStage } from "./generate-header";
import { Card, CardContent } from "@/components/ui/card";

// Example wrapper for demonstration purposes
function ExampleWrapper({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-12">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="relative min-h-[200px] bg-background">
            {children}
            {/* Placeholder content to show header positioning */}
            <div className="p-8 pt-24">
              <div className="h-32 bg-muted/20 rounded-lg flex items-center justify-center text-muted-foreground">
                Page Content Area
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function GenerateHeaderExamples() {
  const [exampleState, setExampleState] = React.useState({
    showDialog: false,
    collapsed: false,
  });

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            GenerateHeader Component Examples
          </h1>
          <p className="text-lg text-muted-foreground">
            Explore different states and configurations of the GenerateHeader
            component used in the /generate page workflow.
          </p>
        </div>

        {/* Example 1: Onboarding Stage */}
        <ExampleWrapper
          title="1. Onboarding Stage"
          description="Initial stage where user provides business information. No unsaved progress, so exit is immediate."
        >
          <GenerateHeader
            currentStage="onboarding"
            hasUnsavedProgress={false}
            onExit={() => console.log("Exit from onboarding")}
          />
        </ExampleWrapper>

        {/* Example 2: Generate Stage */}
        <ExampleWrapper
          title="2. Generate Stage (Active)"
          description="Blueprint is being generated. Shows unsaved progress warning and collapsible option."
        >
          <GenerateHeader
            currentStage="generate"
            hasUnsavedProgress={true}
            collapsible={true}
            defaultCollapsed={false}
            onExit={() => console.log("Exit from generation")}
          />
        </ExampleWrapper>

        {/* Example 3: Generate Stage (Collapsed) */}
        <ExampleWrapper
          title="3. Generate Stage (Collapsed)"
          description="Collapsed view during generation to minimize distraction."
        >
          <GenerateHeader
            currentStage="generate"
            hasUnsavedProgress={true}
            collapsible={true}
            defaultCollapsed={true}
            onExit={() => console.log("Exit from generation")}
          />
        </ExampleWrapper>

        {/* Example 4: Review Stage */}
        <ExampleWrapper
          title="4. Review & Refine Stage"
          description="User is reviewing the generated blueprint. Has unsaved progress if edits were made."
        >
          <GenerateHeader
            currentStage="review"
            hasUnsavedProgress={true}
            onExit={() => console.log("Exit from review")}
          />
        </ExampleWrapper>

        {/* Example 5: Complete Stage */}
        <ExampleWrapper
          title="5. Complete Stage"
          description="Blueprint is complete and approved. No unsaved progress."
        >
          <GenerateHeader
            currentStage="complete"
            hasUnsavedProgress={false}
            onExit={() => console.log("Exit from complete")}
          />
        </ExampleWrapper>

        {/* Example 6: Custom Exit URL */}
        <ExampleWrapper
          title="6. Custom Exit URL"
          description="Header configured with a custom exit destination."
        >
          <GenerateHeader
            currentStage="review"
            hasUnsavedProgress={false}
            exitUrl="/custom-destination"
            onExit={() => console.log("Custom exit handler")}
          />
        </ExampleWrapper>

        {/* Example 7: With Custom Styling */}
        <ExampleWrapper
          title="7. Custom Styling"
          description="Header with additional CSS classes for customization."
        >
          <GenerateHeader
            currentStage="generate"
            hasUnsavedProgress={false}
            className="border-b-2 border-primary/20"
            onExit={() => console.log("Exit with custom styling")}
          />
        </ExampleWrapper>

        {/* Integration Code Example */}
        <div className="mt-16 p-8 bg-muted/50 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Integration Example</h2>
          <pre className="bg-background p-4 rounded-lg overflow-x-auto text-sm">
            <code>{`import { GenerateHeader, type GenerateStage } from "@/components/generate";

export default function GeneratePage() {
  const [pageState, setPageState] = useState<PageState>("onboarding");
  const [strategicBlueprint, setStrategicBlueprint] = useState(null);

  // Map internal state to header stage
  const currentStage: GenerateStage = useMemo(() => {
    if (pageState === "onboarding") return "onboarding";
    if (pageState === "generating-blueprint") return "generate";
    if (pageState === "review-blueprint") return "review";
    return "complete";
  }, [pageState]);

  // Determine unsaved progress
  const hasUnsavedProgress = useMemo(() => {
    return (
      pageState === "generating-blueprint" ||
      (pageState === "review-blueprint" && strategicBlueprint !== null)
    );
  }, [pageState, strategicBlueprint]);

  return (
    <div className="min-h-screen flex flex-col">
      <GenerateHeader
        currentStage={currentStage}
        hasUnsavedProgress={hasUnsavedProgress}
        collapsible={pageState === "generating-blueprint"}
        onExit={() => clearAllSavedData()}
      />

      <div className="flex-1">
        {/* Your page content */}
      </div>
    </div>
  );
}`}</code>
          </pre>
        </div>

        {/* Props Reference */}
        <div className="mt-8 p-8 bg-muted/50 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Props Reference</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">currentStage</h3>
              <p className="text-muted-foreground">
                Type: <code className="bg-background px-2 py-1 rounded">GenerateStage</code>
              </p>
              <p className="text-muted-foreground mt-1">
                Values: "onboarding" | "generate" | "review" | "complete"
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg">hasUnsavedProgress</h3>
              <p className="text-muted-foreground">
                Type: <code className="bg-background px-2 py-1 rounded">boolean</code> (default: false)
              </p>
              <p className="text-muted-foreground mt-1">
                When true, shows confirmation dialog before exit.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg">collapsible</h3>
              <p className="text-muted-foreground">
                Type: <code className="bg-background px-2 py-1 rounded">boolean</code> (default: false)
              </p>
              <p className="text-muted-foreground mt-1">
                Enables collapse toggle button. Useful during generation.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg">exitUrl</h3>
              <p className="text-muted-foreground">
                Type: <code className="bg-background px-2 py-1 rounded">string</code> (default: "/dashboard")
              </p>
              <p className="text-muted-foreground mt-1">
                Destination URL when user exits.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg">onExit</h3>
              <p className="text-muted-foreground">
                Type: <code className="bg-background px-2 py-1 rounded">() =&gt; void</code>
              </p>
              <p className="text-muted-foreground mt-1">
                Callback invoked before navigation. Use for cleanup.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export for easy use in a demo page
export default GenerateHeaderExamples;
