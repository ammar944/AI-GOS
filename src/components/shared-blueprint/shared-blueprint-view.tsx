"use client";

import { Share2, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StrategicBlueprintDisplay } from "@/components/strategic-blueprint/strategic-blueprint-display";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";

interface SharedBlueprintViewProps {
  blueprint: StrategicBlueprintOutput;
  title: string | null;
  createdAt: string;
}

export function SharedBlueprintView({
  blueprint,
  title,
  createdAt,
}: SharedBlueprintViewProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Shared View Header */}
        <div className="mx-auto max-w-5xl mb-8">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Share2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">
                      {title || "Strategic Blueprint"}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Shared on {new Date(createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="w-fit">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Read-only View
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Blueprint Display - reuses existing component */}
        <div className="mx-auto max-w-5xl">
          <StrategicBlueprintDisplay strategicBlueprint={blueprint} />
        </div>

        {/* Footer with CTA */}
        <div className="mx-auto max-w-5xl mt-8">
          <Card className="border-muted">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                Want to create your own Strategic Blueprint?
              </p>
              <a
                href="/generate"
                className="inline-flex items-center gap-2 mt-2 text-primary hover:underline font-medium"
              >
                Get Started
                <ExternalLink className="h-4 w-4" />
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
