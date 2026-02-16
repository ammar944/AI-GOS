"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { RESEARCH_SUBTLE_BLOCK_CLASS } from "@/components/strategic-research/ui-tokens";
import type {
  PlatformCopyVariant,
  MetaAdCopy,
  GoogleRSACopy,
  LinkedInAdCopy,
  TikTokAdCopy,
  YouTubeAdCopy,
} from "@/lib/media-plan/ad-copy-types";

// =============================================================================
// Props
// =============================================================================

interface AdCopyCardProps {
  variant: PlatformCopyVariant;
  angleName: string;
  funnelStage: "cold" | "warm" | "hot";
}

// =============================================================================
// Character-limit map per field
// =============================================================================

const CHAR_LIMITS: Record<string, number> = {
  // Meta
  "meta.primaryText": 300,
  "meta.headline": 40,
  "meta.linkDescription": 30,
  // Google RSA
  "google.headline": 30,
  "google.description": 90,
  // LinkedIn
  "linkedin.introText": 600,
  // TikTok
  "tiktok.adText": 100,
  // YouTube
  "youtube.headlineOverlay": 40,
  "youtube.ctaText": 15,
};

// =============================================================================
// CopyField helper — one field with label, text, char count, copy button
// =============================================================================

function CopyField({
  label,
  value,
  charLimitKey,
  multiline,
  mono,
}: {
  label: string;
  value: string;
  charLimitKey?: string;
  multiline?: boolean;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [value]);

  const maxChars = charLimitKey ? CHAR_LIMITS[charLimitKey] : undefined;
  const currentLen = value.length;
  const overLimit = maxChars ? currentLen >= maxChars : false;

  return (
    <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "group relative p-3")}>
      {/* Header row: label + char count + copy */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)", fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif' }}
        >
          {label}
        </span>

        <div className="flex items-center gap-2">
          {maxChars != null && (
            <span
              className={cn(
                "font-mono text-[10px] tabular-nums",
                overLimit ? "text-red-400" : "text-emerald-400",
              )}
            >
              {currentLen}/{maxChars}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
              "opacity-0 group-hover:opacity-100 focus:opacity-100",
              "hover:bg-white/5",
            )}
            aria-label={`Copy ${label}`}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" style={{ color: "var(--text-tertiary)" }} />
            )}
          </button>
        </div>
      </div>

      {/* Value */}
      <p
        className={cn(
          "text-sm leading-relaxed",
          multiline && "whitespace-pre-wrap",
          mono && "font-mono text-xs",
        )}
        style={{ color: "var(--text-secondary)" }}
      >
        {value}
      </p>
    </div>
  );
}

// =============================================================================
// CTA Badge
// =============================================================================

function CtaBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{
        background: "rgba(54,94,255,0.14)",
        borderColor: "rgba(54,94,255,0.34)",
        color: "rgb(147,197,253)",
      }}
    >
      {label}
    </span>
  );
}

// =============================================================================
// Script Section (TikTok / YouTube video scripts)
// =============================================================================

function ScriptSection({
  label,
  timestamp,
  text,
}: {
  label: string;
  timestamp: string;
  text: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "group relative p-3")}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="rounded-md border px-1.5 py-0.5 font-mono text-[10px]"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--border-default)",
              color: "var(--text-tertiary)",
            }}
          >
            {timestamp}
          </span>
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)", fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif' }}
          >
            {label}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
            "opacity-0 group-hover:opacity-100 focus:opacity-100",
            "hover:bg-white/5",
          )}
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" style={{ color: "var(--text-tertiary)" }} />
          )}
        </button>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {text}
      </p>
    </div>
  );
}

// =============================================================================
// Platform-Specific Renderers
// =============================================================================

function MetaFields({ copy }: { copy: MetaAdCopy }) {
  return (
    <div className="space-y-2">
      <CopyField label="Primary Text" value={copy.primaryText} charLimitKey="meta.primaryText" multiline />

      <div className="grid grid-cols-2 gap-2">
        <CopyField label="Headline" value={copy.headline} charLimitKey="meta.headline" />
        <CopyField label="Link Description" value={copy.linkDescription} charLimitKey="meta.linkDescription" />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
          CTA
        </span>
        <CtaBadge label={copy.ctaButton} />
      </div>
    </div>
  );
}

function GoogleRSAFields({ copy }: { copy: GoogleRSACopy }) {
  return (
    <div className="space-y-3">
      {/* Headlines */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)", fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif' }}
          >
            Headlines
          </span>
          <span className="font-mono text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {copy.headlines.length} of 15
          </span>
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
          {copy.headlines.map((h, i) => (
            <CopyField
              key={i}
              label={`${i + 1}`}
              value={h}
              charLimitKey="google.headline"
              mono
            />
          ))}
        </div>
      </div>

      {/* Descriptions */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)", fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif' }}
          >
            Descriptions
          </span>
          <span className="font-mono text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {copy.descriptions.length} of 4
          </span>
        </div>
        <div className="space-y-1">
          {copy.descriptions.map((d, i) => (
            <CopyField
              key={i}
              label={`${i + 1}`}
              value={d}
              charLimitKey="google.description"
            />
          ))}
        </div>
      </div>

      {/* Display Paths */}
      {(copy.displayPaths[0] || copy.displayPaths[1]) && (
        <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-3")}>
          <span
            className="mb-1 block text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)", fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif' }}
          >
            Display Path
          </span>
          <p className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
            example.com/{copy.displayPaths[0] ?? ""}
            {copy.displayPaths[1] ? `/${copy.displayPaths[1]}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function LinkedInFields({ copy }: { copy: LinkedInAdCopy }) {
  return (
    <div className="space-y-2">
      <CopyField label="Intro Text" value={copy.introText} charLimitKey="linkedin.introText" multiline />

      <div className="flex items-center gap-2 pt-1">
        <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
          CTA
        </span>
        <CtaBadge label={copy.ctaButton} />
      </div>
    </div>
  );
}

function TikTokFields({ copy }: { copy: TikTokAdCopy }) {
  return (
    <div className="space-y-2">
      <CopyField label="Ad Text" value={copy.adText} charLimitKey="tiktok.adText" />

      <div>
        <span
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)", fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif' }}
        >
          Video Script
        </span>
        <div className="space-y-1">
          <ScriptSection label="Hook" timestamp="0-3s" text={copy.videoScript.hook} />
          <ScriptSection label="Body" timestamp="3-15s" text={copy.videoScript.body} />
          <ScriptSection label="CTA" timestamp="15-20s" text={copy.videoScript.cta} />
        </div>
      </div>
    </div>
  );
}

function YouTubeFields({ copy }: { copy: YouTubeAdCopy }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <CopyField label="Headline Overlay" value={copy.headlineOverlay} charLimitKey="youtube.headlineOverlay" />
        <CopyField label="CTA Text" value={copy.ctaText} charLimitKey="youtube.ctaText" />
      </div>

      <div>
        <span
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)", fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif' }}
        >
          Script
        </span>
        <div className="space-y-1">
          <ScriptSection label="Hook" timestamp="0-3s" text={copy.script.hook} />
          <ScriptSection label="Problem / Solution" timestamp="3-15s" text={copy.script.problemSolution} />
          <ScriptSection label="Social Proof" timestamp="15-18s" text={copy.script.socialProof} />
          <ScriptSection label="CTA" timestamp="18-22s" text={copy.script.cta} />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// AdCopyCard — main export
// =============================================================================

export function AdCopyCard({ variant, angleName, funnelStage }: AdCopyCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        "bg-[rgba(12,14,19,0.62)] backdrop-blur-sm",
      )}
      style={{
        borderColor: "var(--border-default)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Card header: angle name + funnel badge */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4
          className="truncate text-sm font-semibold"
          style={{
            color: "var(--text-heading)",
            fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
          }}
        >
          {angleName}
        </h4>
        <FunnelBadge stage={funnelStage} />
      </div>

      {/* Platform-specific fields */}
      {variant.platform === "meta" && <MetaFields copy={variant.copy} />}
      {variant.platform === "google" && <GoogleRSAFields copy={variant.copy} />}
      {variant.platform === "linkedin" && <LinkedInFields copy={variant.copy} />}
      {variant.platform === "tiktok" && <TikTokFields copy={variant.copy} />}
      {variant.platform === "youtube" && <YouTubeFields copy={variant.copy} />}
    </div>
  );
}

// =============================================================================
// Funnel badge (inline, matches section-content pattern)
// =============================================================================

const STATUS_BADGE_COLORS = {
  info: "bg-[rgba(54,94,255,0.14)] text-[rgb(147,197,253)] border-[rgba(54,94,255,0.34)]",
  warning: "bg-[rgba(245,158,11,0.14)] text-[rgb(253,186,116)] border-[rgba(245,158,11,0.34)]",
  danger: "bg-[rgba(239,68,68,0.14)] text-[rgb(252,165,165)] border-[rgba(239,68,68,0.34)]",
  neutral: "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-default)]",
} as const;

const FUNNEL_COLORS: Record<string, keyof typeof STATUS_BADGE_COLORS> = {
  cold: "info",
  warm: "warning",
  hot: "danger",
};

function FunnelBadge({ stage }: { stage: string }) {
  const variant = FUNNEL_COLORS[stage] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        STATUS_BADGE_COLORS[variant],
      )}
    >
      {stage}
    </span>
  );
}
