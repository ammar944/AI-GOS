"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, BarChart3, FileCheck, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { springs } from "@/lib/motion";

type EmptyStateVariant = "all" | "blueprints" | "media-plans" | "search";

interface EmptyStateProps {
  variant: EmptyStateVariant;
  searchQuery?: string;
  onClearSearch?: () => void;
  onSwitchTab?: (tab: string) => void;
}

const config: Record<
  EmptyStateVariant,
  {
    icon: typeof Sparkles;
    title: string;
    description: string;
    cta?: string;
  }
> = {
  all: {
    icon: Sparkles,
    title: "No documents yet",
    description: "Generate your first Strategic Blueprint to get started with AI-powered market research.",
    cta: "Generate Blueprint",
  },
  blueprints: {
    icon: BarChart3,
    title: "No blueprints",
    description: "Create a blueprint with AI-powered market research and competitor analysis.",
    cta: "Generate Blueprint",
  },
  "media-plans": {
    icon: FileCheck,
    title: "No media plans",
    description: "Generate a media plan from any blueprint for execution-ready campaigns.",
  },
  search: {
    icon: SearchX,
    title: "",
    description: "Try adjusting your search or clearing the filter.",
  },
};

export function EmptyState({
  variant,
  searchQuery,
  onClearSearch,
  onSwitchTab,
}: EmptyStateProps) {
  const cfg = config[variant];
  const Icon = cfg.icon;

  const title =
    variant === "search"
      ? "No results found"
      : cfg.title;

  return (
    <motion.div
      className="flex flex-col items-center justify-center py-20 px-6 text-center rounded-xl border border-white/[0.05] bg-white/[0.01]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.gentle}
    >
      {/* Icon container */}
      <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-blue-500/[0.06] border border-blue-500/[0.08] mb-5">
        <Icon className="size-7 text-blue-400/60" />
      </div>

      <h3 className="font-heading font-semibold text-lg text-white">{title}</h3>

      {variant === "search" && searchQuery && (
        <p className="mt-2 text-[13px] text-[var(--text-tertiary)]">
          No matches for{" "}
          <code className="inline-block px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] font-mono text-[12px] text-white/70">
            {searchQuery}
          </code>
        </p>
      )}

      <p className="text-[13px] text-[var(--text-tertiary)] max-w-sm mx-auto mt-2 leading-relaxed">
        {cfg.description}
      </p>

      <div className="flex items-center justify-center gap-3 mt-7">
        {(variant === "all" || variant === "blueprints") && cfg.cta && (
          <Link href="/generate">
            <Button variant="gradient" size="default">
              <Sparkles className="size-4" />
              {cfg.cta}
            </Button>
          </Link>
        )}

        {variant === "media-plans" && onSwitchTab && (
          <Button
            variant="outline"
            size="default"
            className="border-white/[0.08] hover:border-white/[0.15] text-[var(--text-secondary)] hover:text-white"
            onClick={() => onSwitchTab("blueprints")}
          >
            View Blueprints
          </Button>
        )}

        {variant === "search" && onClearSearch && (
          <Button
            variant="outline"
            size="default"
            className="border-white/[0.08] hover:border-white/[0.15] text-[var(--text-secondary)] hover:text-white"
            onClick={onClearSearch}
          >
            Clear Search
          </Button>
        )}
      </div>
    </motion.div>
  );
}
