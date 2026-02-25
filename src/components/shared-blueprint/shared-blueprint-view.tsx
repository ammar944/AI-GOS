"use client";

import { Share2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { PaginatedBlueprintView } from "@/components/strategic-blueprint/paginated-blueprint-view";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";

interface SharedBlueprintViewProps {
  blueprint: StrategicBlueprintOutput;
  title: string | null;
  createdAt: string;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Recently";
  }
}

export function SharedBlueprintView({
  blueprint,
  title,
  createdAt,
}: SharedBlueprintViewProps) {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-base)]">
      {/* Background */}
      <ShaderMeshBackground variant="page" />
      <BackgroundPattern opacity={0.02} />

      {/* Main Content */}
      <main className="flex-1 min-h-0 flex flex-col relative z-10">
        {/* Shared View Header — compact bar */}
        <div className="shrink-0 border-b border-white/[0.06] bg-[rgba(7,9,14,0.8)] backdrop-blur-xl">
          <div className="container mx-auto px-4">
            <div className="flex h-12 items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <Share2 className="h-4 w-4 text-blue-400 shrink-0" />
                <h1 className="text-white/90 text-sm font-semibold font-[family-name:var(--font-heading)] truncate">
                  {title || "Strategic Blueprint"}
                </h1>
                <span className="text-white/25 hidden sm:inline">|</span>
                <span className="text-white/35 text-xs hidden sm:inline shrink-0">
                  {formatDate(createdAt)}
                </span>
              </div>
              <Badge
                variant="outline"
                className="ml-3 shrink-0 flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] text-white/40 text-[11px] px-2 py-0.5"
              >
                <ExternalLink className="h-3 w-3" />
                Read-only
              </Badge>
            </div>
          </div>
        </div>

        {/* Blueprint Content */}
        <div className="flex-1 min-h-0">
          <PaginatedBlueprintView strategicBlueprint={blueprint} />
        </div>

        {/* Footer CTA — compact bar */}
        <div className="shrink-0 border-t border-white/[0.06] bg-[rgba(7,9,14,0.6)] backdrop-blur-xl">
          <div className="container mx-auto px-4">
            <div className="flex h-11 items-center justify-between">
              <p className="text-white/35 text-xs hidden sm:inline">
                Want your own Strategic Blueprint?
              </p>
              <a
                href="/generate"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:opacity-90 bg-gradient-to-r from-blue-600 to-blue-500 text-white ml-auto"
              >
                Get Started
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
