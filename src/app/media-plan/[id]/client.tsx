"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Calendar,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { MediaPlanView, AdCopyView } from "@/components/media-plan";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { GradientBorder } from "@/components/ui/gradient-border";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { easings, durations } from "@/lib/motion";
import type { MediaPlanRecord } from "@/lib/actions/media-plans";
import type { MediaPlanOutput } from "@/lib/media-plan/types";
import type { AdCopyOutput } from "@/lib/media-plan/ad-copy-types";

interface Props {
  mediaPlan: MediaPlanRecord;
  blueprintTitle: string | null;
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

export function MediaPlanViewClient({ mediaPlan, blueprintTitle }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"plan" | "adcopy">("plan");

  const hasAdCopy = mediaPlan.ad_copy !== null && mediaPlan.ad_copy !== undefined;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 backdrop-blur-sm bg-background/80">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Back to Dashboard */}
            <MagneticButton
              className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
              onClick={() => router.push("/dashboard")}
              style={{
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
                background: "transparent",
                fontFamily: "var(--font-sans), Inter, sans-serif",
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </MagneticButton>

            {/* Title */}
            <div className="hidden md:flex items-center gap-2">
              <BarChart3 className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
              <h1
                className="text-lg font-semibold truncate max-w-[300px]"
                style={{
                  color: "var(--text-heading)",
                  fontFamily: "var(--font-heading), 'Instrument Sans', sans-serif",
                }}
              >
                {mediaPlan.title}
              </h1>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {mediaPlan.blueprint_id && (
                <Link href={`/blueprint/${mediaPlan.blueprint_id}`}>
                  <MagneticButton
                    className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
                    style={{
                      border: "1px solid var(--border-default)",
                      color: "var(--text-secondary)",
                      background: "transparent",
                      fontFamily: "var(--font-sans), Inter, sans-serif",
                    }}
                  >
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">View Blueprint</span>
                  </MagneticButton>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Background */}
      <ShaderMeshBackground variant="page" />
      <BackgroundPattern opacity={0.02} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-12 relative z-10">
        {/* Info Card */}
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
                <div>
                  <h2
                    className="text-xl font-semibold"
                    style={{
                      color: "var(--text-heading)",
                      fontFamily: "var(--font-heading), 'Instrument Sans', sans-serif",
                    }}
                  >
                    {mediaPlan.title}
                  </h2>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                      <p
                        className="text-sm"
                        style={{
                          color: "var(--text-tertiary)",
                          fontFamily: "var(--font-sans), Inter, sans-serif",
                        }}
                      >
                        {formatDate(mediaPlan.created_at)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      mediaPlan.status === 'approved'
                        ? 'bg-green-500/15 text-green-400'
                        : 'bg-yellow-500/15 text-yellow-400'
                    }`}>
                      {mediaPlan.status === 'approved' ? 'Approved' : 'Draft'}
                    </span>
                    {hasAdCopy && (
                      <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                        Ad Copy
                      </span>
                    )}
                  </div>
                  {mediaPlan.blueprint_id && blueprintTitle && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <ExternalLink className="h-3.5 w-3.5" style={{ color: "var(--text-tertiary)" }} />
                      <Link
                        href={`/blueprint/${mediaPlan.blueprint_id}`}
                        className="text-sm hover:underline"
                        style={{ color: "var(--accent-blue)" }}
                      >
                        Based on: {blueprintTitle}
                      </Link>
                    </div>
                  )}
                </div>

                {/* Right: Tab toggle (only if ad copy exists) */}
                {hasAdCopy && (
                  <div
                    className="flex rounded-lg p-1"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
                  >
                    <button
                      onClick={() => setActiveTab("plan")}
                      className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
                      style={{
                        background: activeTab === "plan" ? "var(--bg-surface)" : "transparent",
                        color: activeTab === "plan" ? "var(--text-heading)" : "var(--text-tertiary)",
                        fontFamily: "var(--font-sans), Inter, sans-serif",
                      }}
                    >
                      Media Plan
                    </button>
                    <button
                      onClick={() => setActiveTab("adcopy")}
                      className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
                      style={{
                        background: activeTab === "adcopy" ? "var(--bg-surface)" : "transparent",
                        color: activeTab === "adcopy" ? "var(--text-heading)" : "var(--text-tertiary)",
                        fontFamily: "var(--font-sans), Inter, sans-serif",
                      }}
                    >
                      Ad Copy
                    </button>
                  </div>
                )}
              </div>
            </div>
          </GradientBorder>
        </motion.div>

        {/* Content */}
        <motion.div
          className="mx-auto max-w-5xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: durations.normal, ease: easings.out }}
        >
          {activeTab === "plan" ? (
            <MediaPlanView mediaPlan={mediaPlan.output as MediaPlanOutput} />
          ) : hasAdCopy ? (
            <AdCopyView adCopy={mediaPlan.ad_copy as AdCopyOutput} />
          ) : null}
        </motion.div>
      </main>
    </div>
  );
}
