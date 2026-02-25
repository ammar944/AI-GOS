"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  Users,
  Package,
  Swords,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Quote,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { ScoreDisplay } from "@/components/ui/score-display";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

// =============================================================================
// PREMIUM PRIMITIVE COMPONENTS
// =============================================================================

/** Premium section header with unique styling per section */
function SectionHeader({
  number,
  title,
  subtitle,
  icon: Icon,
  accentColor = "var(--accent-blue)",
}: {
  number: number;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  accentColor?: string;
}) {
  return (
    <motion.div variants={fadeInUp} className="mb-10">
      <div className="flex items-start gap-5">
        <div className="flex-shrink-0">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-xl border"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-surface)",
              color: accentColor,
            }}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="pt-1">
          <Badge
            variant="outline"
            className="mb-3 text-[0.65rem] uppercase tracking-[0.2em] border-[var(--border-default)] text-[var(--text-tertiary)] bg-transparent"
            style={{ color: accentColor }}
          >
            Section {number}
          </Badge>
          <h2
            className="text-3xl md:text-4xl font-bold tracking-tight leading-[1.1]"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-heading)",
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-base text-[var(--text-secondary)] mt-2 max-w-xl">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Metric card with clean hierarchy */
function MetricCard({
  label,
  value,
  sublabel,
  variant = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  variant?: "default" | "highlight" | "elevated";
  icon?: React.ElementType;
}) {
  return (
    <motion.div
      variants={scaleIn}
      className="group relative rounded-xl p-6 md:p-8 transition-colors duration-200"
      style={{
        background: "var(--bg-surface)",
        border:
          variant === "highlight"
            ? "1px solid rgba(54, 94, 255, 0.35)"
            : "1px solid var(--border-default)",
      }}
      whileHover={{ y: -2 }}
    >
      <div className="relative">
        {/* Icon */}
        {Icon && (
          <div className="mb-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors">
            <Icon className="h-5 w-5" />
          </div>
        )}

        {/* Label */}
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-3">
          {label}
        </p>

        {/* Value */}
        <p
          className="text-2xl md:text-3xl font-bold tracking-tight"
          style={{
            fontFamily: "var(--font-heading)",
            color:
              variant === "highlight"
                ? "var(--accent-blue)"
                : "var(--text-heading)",
          }}
        >
          {value}
        </p>

        {/* Sublabel */}
        {sublabel && (
          <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
            {sublabel}
          </p>
        )}
      </div>
    </motion.div>
  );
}

/** Editorial insight block with premium styling */
function InsightBlock({
  children,
  source,
  priority = "medium",
}: {
  children: React.ReactNode;
  source?: string;
  priority?: "high" | "medium" | "low";
}) {
  const priorityConfig = {
    high: { color: "var(--accent-blue)" },
    medium: { color: "var(--text-secondary)" },
    low: { color: "var(--text-tertiary)" },
  };

  const config = priorityConfig[priority];

  return (
    <motion.div
      variants={fadeInUp}
      className="relative rounded-xl p-6 md:p-8 border"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-default)",
        borderLeft: `2px solid ${config.color}`,
      }}
    >
      <Quote
        className="absolute top-4 left-4 h-7 w-7 opacity-10"
        style={{ color: config.color }}
      />

      <div className="pl-8">
        <p
          className="text-lg md:text-xl font-medium leading-[1.7] tracking-tight"
          style={{ color: "var(--text-heading)" }}
        >
          {children}
        </p>

        {source && (
          <p className="text-sm text-[var(--text-tertiary)] mt-4 italic">
            — {source}
          </p>
        )}
      </div>
    </motion.div>
  );
}

/** Validation indicator */
function ValidationRing({
  passed,
  label,
}: {
  passed: boolean;
  label: string;
}) {
  return (
    <motion.div
      variants={scaleIn}
      className="flex items-center gap-4 p-4 rounded-xl border transition-colors duration-200"
      style={{
        background: "var(--bg-surface)",
        borderColor: passed ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)",
      }}
      whileHover={{ y: -1 }}
    >
      <div
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center border"
        style={{
          background: passed ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
          borderColor: passed ? "rgba(34, 197, 94, 0.35)" : "rgba(239, 68, 68, 0.35)",
          color: passed ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)",
        }}
      >
        {passed ? (
          <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
        ) : (
          <XCircle className="h-5 w-5" strokeWidth={2.5} />
        )}
      </div>

      <span
        className="text-sm font-medium"
        style={{ color: passed ? "var(--text-heading)" : "var(--text-secondary)" }}
      >
        {label}
      </span>
    </motion.div>
  );
}

/** Warning callout */
function WarningCallout({
  title,
  children,
  variant = "warning",
}: {
  title: string;
  children: React.ReactNode;
  variant?: "warning" | "error" | "info";
}) {
  const config = {
    warning: {
      border: "rgba(245, 158, 11, 0.35)",
      color: "rgb(245, 158, 11)",
      icon: AlertTriangle,
    },
    error: {
      border: "rgba(239, 68, 68, 0.35)",
      color: "rgb(239, 68, 68)",
      icon: XCircle,
    },
    info: {
      border: "rgba(54, 94, 255, 0.35)",
      color: "var(--accent-blue)",
      icon: Lightbulb,
    },
  };

  const { border, color, icon: Icon } = config[variant];

  return (
    <motion.div
      variants={fadeInUp}
      className="relative overflow-hidden rounded-xl p-6 border"
      style={{
        background: "var(--bg-elevated)",
        borderColor: border,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="relative z-10 flex gap-4">
        <div
          className="flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center border"
          style={{
            borderColor: border,
            color,
            background: "transparent",
          }}
        >
          <Icon className="h-6 w-6" strokeWidth={2} />
        </div>

        <div>
          <h4 className="text-base font-semibold mb-2" style={{ color }}>
            {title}
          </h4>
          <div className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** Comparison columns */
function ComparisonColumns({
  strengths,
  weaknesses,
}: {
  strengths: string[];
  weaknesses: string[];
}) {
  return (
    <motion.div variants={stagger} className="grid md:grid-cols-2 gap-6">
      {/* Strengths */}
      <motion.div
        variants={fadeInUp}
        className="relative rounded-xl p-6 border"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-default)",
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg border border-emerald-400/40 text-emerald-300">
            <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <h4 className="text-lg font-semibold text-[var(--text-heading)]">
            Strengths
          </h4>
        </div>

        <ul className="space-y-3">
          {strengths.map((item, i) => (
            <motion.li
              key={i}
              variants={scaleIn}
              className="flex items-start gap-3 p-3 rounded-lg"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
              }}
            >
              <ChevronRight
                className="h-4 w-4 mt-0.5 flex-shrink-0"
                style={{ color: "rgb(34, 197, 94)" }}
              />
              <span className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {item}
              </span>
            </motion.li>
          ))}
        </ul>
      </motion.div>

      {/* Weaknesses */}
      <motion.div
        variants={fadeInUp}
        className="relative rounded-xl p-6 border"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-default)",
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg border border-red-400/40 text-red-300">
            <XCircle className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <h4 className="text-lg font-semibold text-[var(--text-heading)]">Weaknesses</h4>
        </div>

        <ul className="space-y-3">
          {weaknesses.map((item, i) => (
            <motion.li
              key={i}
              variants={scaleIn}
              className="flex items-start gap-3 p-3 rounded-lg"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
              }}
            >
              <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-300" />
              <span className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {item}
              </span>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}

/** Timeline step */
function TimelineStep({
  number,
  title,
  isLast = false,
}: {
  number: number;
  title: string;
  isLast?: boolean;
}) {
  return (
    <motion.div variants={fadeInUp} className="flex items-start gap-5">
      <div className="flex flex-col items-center">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border"
          style={{
            background: "var(--bg-surface)",
            fontFamily: "var(--font-heading)",
            borderColor: "var(--border-default)",
            color: "var(--text-heading)",
          }}
        >
          {number}
        </div>
        {!isLast && (
          <motion.div
            className="w-0.5 h-16 mt-3"
            style={{ background: "var(--border-default)" }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
        )}
      </div>

      <div className="flex-1 pt-3">
        <p
          className="text-base font-medium leading-relaxed"
          style={{ color: "var(--text-heading)" }}
        >
          {title}
        </p>
      </div>
    </motion.div>
  );
}

/** Section divider */
function SectionDivider() {
  return (
    <motion.div variants={fadeInUp} className="my-16 md:my-20">
      <Separator />
    </motion.div>
  );
}

// =============================================================================
// SAMPLE DATA
// =============================================================================

const sampleData = {
  industryMarket: {
    category: "B2B SaaS Marketing",
    maturity: "Growing",
    salesCycle: "30-90 days",
    painPoints: [
      "Difficulty attributing revenue to marketing efforts across multiple touchpoints",
      "Scattered data across 10+ platforms making unified reporting impossible",
      "Manual reporting consuming 10+ hours weekly for marketing teams",
    ],
    insight:
      "The market is shifting from tool-based solutions to outcome-based platforms. Buyers increasingly want proven ROI metrics, not just feature lists. Companies demonstrating clear attribution win 3x more deals.",
  },
  icpValidation: {
    status: "validated",
    checks: {
      clearlyDefined: true,
      reachable: true,
      hasScale: true,
      hasPain: true,
      hasBudget: false,
    },
  },
  offerAnalysis: {
    overallScore: 7.4,
    scores: {
      painRelevance: 8.2,
      urgency: 7.1,
      differentiation: 5.8,
      tangibility: 8.5,
      proof: 7.3,
      pricing: 7.8,
    },
  },
  competitors: [
    {
      name: "HubSpot Marketing Hub",
      positioning: "All-in-one marketing platform for growing businesses",
      strengths: [
        "Strong brand recognition and trust",
        "Extensive ecosystem with 1000+ integrations",
        "Generous free tier attracts users",
      ],
      weaknesses: [
        "Expensive at scale ($3,200+/mo for enterprise)",
        "Complex setup requires dedicated admin",
        "Generic features lack vertical specialization",
      ],
    },
  ],
  synthesis: {
    positioning:
      "The only marketing analytics platform built specifically for B2B SaaS companies that proves ROI in 30 days or less.",
    nextSteps: [
      "Refine ICP to focus on 50-200 employee SaaS companies with $5M+ ARR",
      "Develop 3 case studies showing measurable ROI within 30 days",
      "Create comparison landing pages positioning against HubSpot",
      "Launch targeted LinkedIn campaign to VP Marketing and CMO titles",
    ],
  },
};

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function BlueprintPreviewPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-xl"
        style={{
          background: "rgba(7, 9, 14, 0.8)",
          borderColor: "var(--border-default)",
        }}
      >
        <div className="container mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Link
              href="/"
              className="text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors"
            >
              <ChevronRight className="h-5 w-5 rotate-180" />
            </Link>
            <div className="h-6 w-px bg-[var(--border-default)]" />
            <h1
              className="text-lg font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Blueprint Preview
            </h1>
          </div>
          <span
            className="text-xs font-semibold uppercase tracking-[0.15em] px-4 py-2 rounded-full"
            style={{
              background: "rgba(54, 94, 255, 0.1)",
              color: "var(--accent-blue)",
              border: "1px solid rgba(54, 94, 255, 0.2)",
            }}
          >
            Design V2
          </span>
        </div>
      </header>

      <main className="container mx-auto px-6 py-16 max-w-5xl">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="space-y-0"
        >
          {/* ============================================
              SECTION 1: Industry & Market Overview
              ============================================ */}
          <section>
            <SectionHeader
              number={1}
              title="Industry & Market Overview"
              subtitle="Deep analysis of market dynamics, pain points, and opportunities"
              icon={TrendingUp}
              accentColor="var(--accent-blue)"
            />

            {/* Metrics Grid */}
            <motion.div
              variants={stagger}
              className="grid md:grid-cols-3 gap-5 mb-10"
            >
              <MetricCard
                label="Market Category"
                value={sampleData.industryMarket.category}
                variant="highlight"
                icon={Target}
              />
              <MetricCard
                label="Market Maturity"
                value={sampleData.industryMarket.maturity}
                sublabel="Rapid growth phase with increasing competition"
              />
              <MetricCard
                label="Sales Cycle"
                value={sampleData.industryMarket.salesCycle}
                sublabel="B2B enterprise decision timeline"
              />
            </motion.div>

            {/* Key Insight */}
            <div className="mb-10">
              <InsightBlock source="Market Analysis" priority="high">
                {sampleData.industryMarket.insight}
              </InsightBlock>
            </div>

            {/* Pain Points */}
            <motion.div variants={stagger}>
              <h3
                className="text-lg font-semibold mb-5 tracking-tight"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--text-heading)",
                }}
              >
                Primary Pain Points
              </h3>
              <div className="space-y-3">
                {sampleData.industryMarket.painPoints.map((pain, i) => (
                  <motion.div
                    key={i}
                    variants={scaleIn}
                    className="flex items-start gap-4 p-5 rounded-xl transition-all duration-300"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-default)",
                    }}
                    whileHover={{
                      x: 4,
                      borderColor: "rgba(239, 68, 68, 0.3)",
                    }}
                  >
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{
                        background: "rgba(239, 68, 68, 0.1)",
                        color: "var(--error)",
                        fontFamily: "var(--font-heading)",
                      }}
                    >
                      {i + 1}
                    </div>
                    <p className="text-[var(--text-secondary)] pt-1 leading-relaxed">
                      {pain}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </section>

          <SectionDivider />

          {/* ============================================
              SECTION 2: ICP Validation
              ============================================ */}
          <section>
            <SectionHeader
              number={2}
              title="ICP Analysis & Validation"
              subtitle="Validating your ideal customer profile against market realities"
              icon={Users}
              accentColor="var(--success)"
            />

            {/* Verdict Banner */}
            <motion.div
              variants={scaleIn}
              className="relative overflow-hidden rounded-2xl p-8 mb-10"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div className="relative z-10 flex items-center gap-6">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center border"
                  style={{
                    background: "rgba(34, 197, 94, 0.12)",
                    borderColor: "rgba(34, 197, 94, 0.35)",
                    color: "rgb(34, 197, 94)",
                  }}
                >
                  <CheckCircle2 className="h-7 w-7" strokeWidth={2.5} />
                </div>

                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-[0.2em] mb-1"
                    style={{ color: "var(--success)" }}
                  >
                    ICP Status
                  </p>
                  <h3
                    className="text-3xl font-bold tracking-tight"
                    style={{
                      fontFamily: "var(--font-heading)",
                      color: "var(--text-heading)",
                    }}
                  >
                    VALIDATED
                  </h3>
                </div>
              </div>

              <p className="relative z-10 text-[var(--text-secondary)] mt-4 max-w-2xl leading-relaxed">
                Your ICP shows strong market fit with adequate scale and clear pain alignment.
                Minor budget concerns can be addressed through pricing strategy adjustments.
              </p>
            </motion.div>

            {/* Validation Checks */}
            <motion.div variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ValidationRing passed={true} label="Clearly Defined" />
              <ValidationRing passed={true} label="Reachable via Paid Channels" />
              <ValidationRing passed={true} label="Adequate Market Scale" />
              <ValidationRing passed={true} label="Has Pain Offer Solves" />
              <ValidationRing passed={false} label="Has Budget Verified" />
            </motion.div>
          </section>

          <SectionDivider />

          {/* ============================================
              SECTION 3: Offer Analysis
              ============================================ */}
          <section>
            <SectionHeader
              number={3}
              title="Offer Analysis & Viability"
              subtitle="Comprehensive scoring of your offer strength and market fit"
              icon={Package}
              accentColor="var(--accent-blue)"
            />

            {/* Score Display */}
            <motion.div
              variants={scaleIn}
              className="rounded-2xl p-8 md:p-10 mb-10"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
                {/* Main Score */}
                <div className="flex flex-col items-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-4">
                    Overall Score
                  </p>
                  <ScoreDisplay
                    score={sampleData.offerAnalysis.overallScore}
                    max={10}
                    size="xl"
                    animated={true}
                  />
                </div>

                {/* Sub Scores */}
                <div className="flex-1 w-full grid grid-cols-2 gap-x-8 gap-y-5">
                  {Object.entries(sampleData.offerAnalysis.scores).map(
                    ([key, value]) => (
                      <ScoreDisplay
                        key={key}
                        score={value}
                        max={10}
                        label={key
                          .replace(/([A-Z])/g, " $1")
                          .replace(/^./, (s) => s.toUpperCase())}
                        size="md"
                        animated={true}
                      />
                    )
                  )}
                </div>
              </div>
            </motion.div>

            {/* Warning */}
            <WarningCallout title="Differentiation Gap Detected" variant="warning">
              <p>
                Your offer scores below average on differentiation (5.8/10). Consider emphasizing
                unique outcomes, proprietary methodology, or vertical-specific features to stand out
                in a crowded market.
              </p>
            </WarningCallout>
          </section>

          <SectionDivider />

          {/* ============================================
              SECTION 4: Competitor Analysis
              ============================================ */}
          <section>
            <SectionHeader
              number={4}
              title="Competitor Analysis"
              subtitle="Intelligence on key competitors and market positioning"
              icon={Swords}
              accentColor="rgb(168, 85, 247)"
            />

            {/* Competitor Card */}
            <motion.div
              variants={scaleIn}
              className="rounded-2xl p-8 mb-8"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3
                    className="text-2xl font-bold tracking-tight mb-2"
                    style={{
                      fontFamily: "var(--font-heading)",
                      color: "var(--text-heading)",
                    }}
                  >
                    {sampleData.competitors[0].name}
                  </h3>
                  <p className="text-[var(--text-secondary)]">
                    {sampleData.competitors[0].positioning}
                  </p>
                </div>
                <a
                  href="#"
                  className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  style={{
                    color: "var(--accent-blue)",
                    background: "rgba(54, 94, 255, 0.1)",
                  }}
                >
                  View site <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <ComparisonColumns
                strengths={sampleData.competitors[0].strengths}
                weaknesses={sampleData.competitors[0].weaknesses}
              />
            </motion.div>
          </section>

          <SectionDivider />

          {/* ============================================
              SECTION 5: Cross-Analysis Synthesis
              ============================================ */}
          <section>
            <SectionHeader
              number={5}
              title="Cross-Analysis Synthesis"
              subtitle="Strategic recommendations and action plan"
              icon={Lightbulb}
              accentColor="var(--warning)"
            />

            {/* Positioning Statement */}
            <motion.div
              variants={scaleIn}
              className="relative overflow-hidden rounded-2xl p-8 md:p-10 mb-10"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
              }}
            >
              <Sparkles
                className="absolute top-6 right-6 h-8 w-8 opacity-20"
                style={{ color: "var(--accent-blue)" }}
              />

              <p
                className="text-xs font-semibold uppercase tracking-[0.2em] mb-4"
                style={{ color: "var(--accent-blue)" }}
              >
                Recommended Positioning
              </p>
              <p
                className="text-2xl md:text-3xl font-bold leading-[1.3] tracking-tight max-w-3xl"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--text-heading)",
                }}
              >
                "{sampleData.synthesis.positioning}"
              </p>
            </motion.div>

            {/* Next Steps */}
            <motion.div variants={stagger}>
              <h3
                className="text-lg font-semibold mb-8 tracking-tight"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--text-heading)",
                }}
              >
                Recommended Next Steps
              </h3>
              <div className="space-y-0">
                {sampleData.synthesis.nextSteps.map((step, i) => (
                  <TimelineStep
                    key={i}
                    number={i + 1}
                    title={step}
                    isLast={i === sampleData.synthesis.nextSteps.length - 1}
                  />
                ))}
              </div>
            </motion.div>
          </section>
        </motion.div>

        {/* Footer */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="mt-20 pt-10 border-t text-center"
          style={{ borderColor: "var(--border-default)" }}
        >
          <p className="text-sm text-[var(--text-tertiary)]">
            Premium Blueprint UI Preview — Using SaaSLaunch Design System
          </p>
        </motion.div>
      </main>
    </div>
  );
}
