"use client";

import { motion } from "framer-motion";
import { Share2, ExternalLink, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GradientBorder } from "@/components/ui/gradient-border";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { PaginatedBlueprintView } from "@/components/strategic-blueprint/paginated-blueprint-view";
import { easings, durations } from "@/lib/motion";
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
        {/* Shared View Header */}
        <div className="shrink-0 container mx-auto px-4 pt-4 pb-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: durations.normal, ease: easings.out }}
          >
            <GradientBorder>
              <div className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  {/* Left: Info */}
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500/[0.15] flex size-10 items-center justify-center rounded-full shrink-0">
                      <Share2 className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <h1 className="text-white/90 text-xl font-semibold font-[family-name:var(--font-heading)]">
                        {title || "Strategic Blueprint"}
                      </h1>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4 text-white/30" />
                        <p className="text-white/40 text-sm">
                          Shared on {formatDate(createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right: Badge */}
                  <Badge
                    variant="secondary"
                    className="w-fit flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] text-white/50"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Read-only View
                  </Badge>
                </div>
              </div>
            </GradientBorder>
          </motion.div>
        </div>

        {/* Blueprint Content */}
        <div className="flex-1 min-h-0">
          <PaginatedBlueprintView strategicBlueprint={blueprint} />
        </div>

        {/* Footer with CTA */}
        <div className="shrink-0 container mx-auto px-4 py-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: durations.normal, ease: easings.out }}
          >
            <GradientBorder>
              <div className="p-6 text-center">
                <p className="text-white/60 text-base">
                  Want to create your own Strategic Blueprint?
                </p>
                <a
                  href="/generate"
                  className="inline-flex items-center gap-2 mt-3 px-6 py-2.5 rounded-full font-medium transition-all duration-200 hover:scale-105 bg-gradient-to-r from-blue-600 to-blue-500 text-white"
                >
                  Get Started
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </GradientBorder>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
