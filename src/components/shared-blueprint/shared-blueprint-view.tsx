"use client";

import { motion } from "framer-motion";
import { Share2, ExternalLink, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GradientBorder } from "@/components/ui/gradient-border";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { PolishedBlueprintView } from "@/components/strategic-blueprint/polished-blueprint-view";
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
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      {/* Background */}
      <ShaderMeshBackground variant="page" />
      <BackgroundPattern opacity={0.02} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-12 relative z-10">
        {/* Shared View Header */}
        <motion.div
          className="mx-auto max-w-5xl mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: durations.normal, ease: easings.out }}
        >
          <GradientBorder>
            <div className="p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {/* Left: Info */}
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full"
                    style={{
                      background: "var(--accent-blue)",
                      opacity: 0.2,
                    }}
                  >
                    <Share2 className="h-5 w-5" style={{ color: "var(--accent-blue)" }} />
                  </div>
                  <div>
                    <h1
                      className="text-xl font-semibold"
                      style={{
                        color: "var(--text-heading)",
                        fontFamily: "var(--font-heading), 'Instrument Sans', sans-serif",
                      }}
                    >
                      {title || "Strategic Blueprint"}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                      <p
                        className="text-sm"
                        style={{
                          color: "var(--text-tertiary)",
                          fontFamily: "var(--font-sans), Inter, sans-serif",
                        }}
                      >
                        Shared on {formatDate(createdAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right: Badge */}
                <Badge
                  variant="secondary"
                  className="w-fit flex items-center gap-1"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-sans), Inter, sans-serif",
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Read-only View
                </Badge>
              </div>
            </div>
          </GradientBorder>
        </motion.div>

        {/* Blueprint Content */}
        <motion.div
          className="mx-auto max-w-5xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: durations.normal, ease: easings.out }}
        >
          <PolishedBlueprintView strategicBlueprint={blueprint} />
        </motion.div>

        {/* Footer with CTA */}
        <motion.div
          className="mx-auto max-w-5xl mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: durations.normal, ease: easings.out }}
        >
          <GradientBorder>
            <div className="p-6 text-center">
              <p
                className="text-base"
                style={{
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-sans), Inter, sans-serif",
                }}
              >
                Want to create your own Strategic Blueprint?
              </p>
              <a
                href="/generate"
                className="inline-flex items-center gap-2 mt-3 px-6 py-2.5 rounded-full font-medium transition-all duration-200 hover:scale-105"
                style={{
                  background: "var(--gradient-primary)",
                  color: "white",
                  fontFamily: "var(--font-display), 'Cabinet Grotesk', sans-serif",
                }}
              >
                Get Started
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </GradientBorder>
        </motion.div>
      </main>
    </div>
  );
}
