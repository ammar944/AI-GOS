"use client";

import { useRef, useCallback, useState } from "react";
import {
  FileText,
  Target,
  Lightbulb,
  Users,
  Layout,
  GitBranch,
  Palette,
  Layers,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Clock,
  Coins,
  Check,
  Download,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type {
  MediaPlanOutput,
  MediaPlanSection,
} from "@/lib/media-plan/output-types";

interface MediaPlanDisplayProps {
  mediaPlan: MediaPlanOutput;
}

// Section icons mapping
const SECTION_ICONS: Record<MediaPlanSection, React.ReactNode> = {
  executiveSummary: <FileText className="h-5 w-5" />,
  campaignObjectiveSelection: <Target className="h-5 w-5" />,
  keyInsightsFromResearch: <Lightbulb className="h-5 w-5" />,
  icpAndTargetingStrategy: <Users className="h-5 w-5" />,
  platformAndChannelStrategy: <Layout className="h-5 w-5" />,
  funnelStrategy: <GitBranch className="h-5 w-5" />,
  creativeStrategy: <Palette className="h-5 w-5" />,
  campaignStructure: <Layers className="h-5 w-5" />,
  kpisAndPerformanceModel: <TrendingUp className="h-5 w-5" />,
  budgetAllocationAndScaling: <DollarSign className="h-5 w-5" />,
  risksAndMitigation: <AlertTriangle className="h-5 w-5" />,
};

const SECTION_LABELS: Record<MediaPlanSection, string> = {
  executiveSummary: "Executive Summary",
  campaignObjectiveSelection: "Campaign Objective Selection",
  keyInsightsFromResearch: "Key Insights From Strategic Research",
  icpAndTargetingStrategy: "ICP and Targeting Strategy",
  platformAndChannelStrategy: "Platform and Channel Strategy",
  funnelStrategy: "Funnel Strategy",
  creativeStrategy: "Creative Strategy",
  campaignStructure: "Campaign Structure",
  kpisAndPerformanceModel: "KPIs and Performance Model",
  budgetAllocationAndScaling: "Budget Allocation and Scaling Roadmap",
  risksAndMitigation: "Risks and Mitigation",
};

// Section Component - Always visible, no collapse functionality
function Section({
  title,
  icon,
  children,
  sectionNumber,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  sectionNumber: number;
}) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-primary/20">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-lg">
          {sectionNumber}
        </div>
        <div className="flex items-center gap-2 text-primary">
          {icon}
        </div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
      </div>
      <div className="pl-2">{children}</div>
    </div>
  );
}

// Sub-section header
function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 mb-6">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide border-l-4 border-primary/40 pl-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

// List item
function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

// Safe render helper - converts any value to a displayable string
function safeRender(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(safeRender).join(", ");
  if (typeof value === "object") {
    // Try to extract meaningful values from object
    const obj = value as Record<string, unknown>;
    const values = Object.values(obj).filter(v => v !== null && v !== undefined);
    if (values.length === 0) return "";
    return values.map(safeRender).join(", ");
  }
  return String(value);
}

// Safe array helper - ensures we always have an array of strings
function safeArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(safeRender);
  if (typeof value === "object") {
    // If it's an object, try to get array values from common keys
    const obj = value as Record<string, unknown>;
    for (const key of ["items", "values", "list", "titles", "jobTitles"]) {
      if (Array.isArray(obj[key])) return (obj[key] as unknown[]).map(safeRender);
    }
    // Otherwise return object values as array
    return Object.values(obj).filter(v => v !== null && v !== undefined).map(safeRender);
  }
  return [safeRender(value)];
}

export function MediaPlanDisplay({ mediaPlan }: MediaPlanDisplayProps) {
  const {
    executiveSummary,
    campaignObjectiveSelection,
    keyInsightsFromResearch,
    icpAndTargetingStrategy,
    platformAndChannelStrategy,
    funnelStrategy,
    creativeStrategy,
    campaignStructure,
    kpisAndPerformanceModel,
    budgetAllocationAndScaling,
    risksAndMitigation,
    metadata,
  } = mediaPlan;

  const documentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = useCallback(async () => {
    if (!documentRef.current) return;

    setIsExporting(true);

    try {
      // Dynamically import html2pdf to avoid SSR issues
      const html2pdf = (await import("html2pdf.js")).default;

      // Clone the element to avoid modifying the original
      const element = documentRef.current;

      // Add print-friendly class for PDF export
      element.classList.add("pdf-export");

      const date = new Date().toISOString().split("T")[0];
      const filename = `Media-Plan-${date}.pdf`;

      const opt = {
        margin: [10, 10, 10, 10],
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          scrollY: 0,
          backgroundColor: "#ffffff",
          logging: false,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait" as const,
        },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };

      await html2pdf().set(opt).from(element).save();

      // Remove print-friendly class after export
      element.classList.remove("pdf-export");
    } catch (error) {
      console.error("PDF export failed:", error);
      // Ensure class is removed even on error
      documentRef.current?.classList.remove("pdf-export");
    } finally {
      setIsExporting(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-primary/10 to-background py-8 px-4">
      {/* Document Container */}
      <div className="max-w-4xl mx-auto">
        {/* Document Header - outside the white paper */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Media Plan</h1>
            <p className="text-muted-foreground">
              Generated on {new Date(metadata.generatedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm bg-background/80 backdrop-blur rounded-lg px-3 py-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{Math.round(metadata.processingTime / 1000)}s</span>
            </div>
            <div className="flex items-center gap-2 text-sm bg-background/80 backdrop-blur rounded-lg px-3 py-1.5">
              <Coins className="h-4 w-4 text-muted-foreground" />
              <span>${metadata.totalCost.toFixed(4)}</span>
            </div>
            <Badge variant="secondary" className="bg-background/80 backdrop-blur">
              v{metadata.version}
            </Badge>
            <Button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export PDF
                </>
              )}
            </Button>
          </div>
        </div>

        {/* White Document/Paper */}
        <div
          ref={documentRef}
          className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl shadow-primary/10 border border-border/50"
        >
          {/* Document inner padding */}
          <div className="px-8 py-10 md:px-12 md:py-14 lg:px-16 lg:py-16">

            {/* Document Title */}
            <div className="text-center mb-12 pb-8 border-b border-border">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                Full Media Plan
              </h1>
              <p className="text-muted-foreground">
                Strategic Advertising Campaign Blueprint
              </p>
            </div>

            {/* Section 1: Executive Summary */}
            <Section
              title={SECTION_LABELS.executiveSummary}
              icon={SECTION_ICONS.executiveSummary}
              sectionNumber={1}
            >
              <div className="space-y-6">
                <div className="rounded-lg bg-primary/5 border border-primary/10 p-5">
                  <p className="text-lg leading-relaxed">{executiveSummary.strategyOverview}</p>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <SubSection title="Timeline Focus">
                    <p className="text-foreground">{executiveSummary.timelineFocus}</p>
                  </SubSection>
                  <SubSection title="Expected Outcome">
                    <p className="text-foreground">{executiveSummary.expectedOutcome}</p>
                  </SubSection>
                </div>
                <SubSection title="Strategic Priorities">
                  <ol className="list-decimal list-inside space-y-2 text-foreground">
                    {safeArray(executiveSummary.strategicPriorities).map((priority, i) => (
                      <li key={i} className="leading-relaxed">{priority}</li>
                    ))}
                  </ol>
                </SubSection>
                <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-5">
                  <p className="text-sm text-muted-foreground mb-2">Positioning Statement</p>
                  <p className="font-medium italic text-lg">&ldquo;{executiveSummary.positioningStatement}&rdquo;</p>
                </div>
              </div>
            </Section>

            {/* Section 2: Campaign Objective Selection */}
            <Section
              title={SECTION_LABELS.campaignObjectiveSelection}
              icon={SECTION_ICONS.campaignObjectiveSelection}
              sectionNumber={2}
            >
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-lg border p-5">
                    <Badge className="mb-3">{campaignObjectiveSelection.businessGoal.goal.replace(/_/g, " ")}</Badge>
                    <p className="text-foreground">{campaignObjectiveSelection.businessGoal.description}</p>
                  </div>
                  <div className="rounded-lg border p-5">
                    <Badge variant="secondary" className="mb-3">
                      {campaignObjectiveSelection.marketingObjective.objective}
                    </Badge>
                    <p className="text-foreground">{campaignObjectiveSelection.marketingObjective.description}</p>
                  </div>
                </div>
                <SubSection title="Platform Logic">
                  <div className="rounded-lg bg-muted/30 p-5 space-y-3">
                    <p><strong>Sales Cycle:</strong> {campaignObjectiveSelection.platformLogic.salesCycleConsideration}</p>
                    <p><strong>Platform Implications:</strong> {campaignObjectiveSelection.platformLogic.platformImplications}</p>
                    <p><strong>Recommended:</strong> {campaignObjectiveSelection.platformLogic.recommendedPlatform}</p>
                  </div>
                </SubSection>
                <SubSection title="Final Objective">
                  <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-5">
                    <p className="font-semibold text-xl mb-3">{campaignObjectiveSelection.finalObjective.statement}</p>
                    <p className="text-muted-foreground mb-4">{campaignObjectiveSelection.finalObjective.reasoning}</p>
                    <div className="space-y-2">
                      <p className="font-medium">Success Criteria:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {safeArray(campaignObjectiveSelection.finalObjective?.successCriteria).map((criteria, i) => (
                          <li key={i}>{criteria}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </SubSection>
              </div>
            </Section>

            {/* Section 3: Key Insights */}
            <Section
              title={SECTION_LABELS.keyInsightsFromResearch}
              icon={SECTION_ICONS.keyInsightsFromResearch}
              sectionNumber={3}
            >
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <SubSection title="Pain Points">
                    <div className="space-y-3">
                      <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
                        <p className="font-medium text-red-700 dark:text-red-400">
                          Primary: {keyInsightsFromResearch.painPoints.primary}
                        </p>
                      </div>
                      <ul className="space-y-2">
                        {safeArray(keyInsightsFromResearch.painPoints?.secondary).map((pain, i) => (
                          <ListItem key={i}>{pain}</ListItem>
                        ))}
                      </ul>
                    </div>
                  </SubSection>
                  <SubSection title="Differentiation">
                    <ul className="space-y-2">
                      {safeArray(keyInsightsFromResearch.differentiation?.uniqueStrengths).map((strength, i) => (
                        <ListItem key={i}>{strength}</ListItem>
                      ))}
                    </ul>
                  </SubSection>
                </div>
                <SubSection title="Top Insights">
                  <div className="grid gap-4 md:grid-cols-2">
                    {keyInsightsFromResearch.topInsights.map((insight, i) => (
                      <div key={i} className="rounded-lg border p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="outline" className="capitalize">
                            {insight.category.replace(/_/g, " ")}
                          </Badge>
                          <Badge
                            variant={insight.confidence === "high" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {insight.confidence} confidence
                          </Badge>
                        </div>
                        <p className="font-medium mb-2">{insight.insight}</p>
                        <p className="text-sm text-muted-foreground">{insight.implication}</p>
                      </div>
                    ))}
                  </div>
                </SubSection>
              </div>
            </Section>

            {/* Section 4: ICP and Targeting */}
            <Section
              title={SECTION_LABELS.icpAndTargetingStrategy}
              icon={SECTION_ICONS.icpAndTargetingStrategy}
              sectionNumber={4}
            >
              <div className="space-y-6">
                <SubSection title="Primary Audience">
                  <div className="rounded-lg border p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-lg">{icpAndTargetingStrategy.primaryAudience.name}</h4>
                      <Badge>{icpAndTargetingStrategy.primaryAudience.estimatedSize}</Badge>
                    </div>
                    <p className="text-muted-foreground mb-4">
                      {icpAndTargetingStrategy.primaryAudience.description}
                    </p>
                    {icpAndTargetingStrategy.primaryAudience.professional && (
                      <div className="flex flex-wrap gap-2">
                        {safeArray(icpAndTargetingStrategy.primaryAudience.professional.jobTitles || icpAndTargetingStrategy.primaryAudience.professional).map((title, i) => (
                          <Badge key={i} variant="secondary">
                            {title}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </SubSection>
                <SubSection title="Targeting Methods">
                  <div className="grid gap-4 md:grid-cols-2">
                    {icpAndTargetingStrategy.targetingMethods.map((method, i) => (
                      <div key={i} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="outline">{method.method.replace(/_/g, " ")}</Badge>
                          <span className="text-sm text-muted-foreground">{method.platform}</span>
                        </div>
                        <p>{method.configuration}</p>
                      </div>
                    ))}
                  </div>
                </SubSection>
              </div>
            </Section>

            {/* Section 5: Platform Strategy */}
            <Section
              title={SECTION_LABELS.platformAndChannelStrategy}
              icon={SECTION_ICONS.platformAndChannelStrategy}
              sectionNumber={5}
            >
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <span className="font-medium">Priority Order:</span>
                  {safeArray(platformAndChannelStrategy.priorityOrder).map((platform, i) => (
                    <Badge key={platform} variant={i === 0 ? "default" : "secondary"}>
                      {i + 1}. {platform}
                    </Badge>
                  ))}
                </div>
                <div className="space-y-4">
                  {platformAndChannelStrategy.platforms.map((platform) => (
                    <div key={platform.platform} className="rounded-lg border p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-lg capitalize">{platform.platform.replace(/_/g, " ")}</h4>
                        <Badge variant="outline">{platform.role.replace(/_/g, " ")}</Badge>
                      </div>
                      <div className="grid gap-6 md:grid-cols-2">
                        <div>
                          <p className="font-medium mb-2">Why Selected:</p>
                          <ul className="space-y-2">
                            {safeArray(platform.whySelected).map((reason, i) => (
                              <ListItem key={i}>{reason}</ListItem>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium mb-2">Ad Formats:</p>
                          <div className="flex flex-wrap gap-2">
                            {safeArray(platform.adFormats).map((format, i) => (
                              <Badge key={i} variant="secondary">
                                {format}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-muted/30 p-5">
                  <p>
                    <strong>Platform Synergy:</strong> {platformAndChannelStrategy.platformSynergy}
                  </p>
                </div>
              </div>
            </Section>

            {/* Section 6: Funnel Strategy */}
            <Section
              title={SECTION_LABELS.funnelStrategy}
              icon={SECTION_ICONS.funnelStrategy}
              sectionNumber={6}
            >
              <div className="space-y-6">
                <div className="rounded-lg bg-primary/5 border border-primary/10 p-5">
                  <p className="font-mono text-sm">{funnelStrategy.funnelFlow}</p>
                </div>
                <SubSection title="Funnel Stages">
                  <div className="grid gap-4 md:grid-cols-3">
                    {funnelStrategy.stages.map((stage) => (
                      <div key={stage.stage} className="rounded-lg border p-5">
                        <Badge className="mb-3">{stage.label}</Badge>
                        <p className="font-medium mb-2">{stage.objective}</p>
                        <p className="text-sm text-muted-foreground">
                          Expected Conversion: {stage.expectedConversionRate}
                        </p>
                      </div>
                    ))}
                  </div>
                </SubSection>
                <SubSection title="Retargeting Paths">
                  <div className="grid gap-4 md:grid-cols-3">
                    {funnelStrategy.retargetingPaths.map((path) => (
                      <div key={path.window} className="rounded-lg border p-4">
                        <Badge variant="outline" className="mb-3">
                          {path.label}
                        </Badge>
                        <p className="mb-2">{path.messageFocus}</p>
                        <p className="text-sm text-muted-foreground">
                          Frequency: {path.frequencyCap}
                        </p>
                      </div>
                    ))}
                  </div>
                </SubSection>
              </div>
            </Section>

            {/* Section 7: Creative Strategy */}
            <Section
              title={SECTION_LABELS.creativeStrategy}
              icon={SECTION_ICONS.creativeStrategy}
              sectionNumber={7}
            >
              <div className="space-y-6">
                <SubSection title="Primary Angles">
                  <div className="space-y-4">
                    {creativeStrategy.primaryAngles.map((angle, i) => (
                      <div key={i} className="rounded-lg border p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-lg">{angle.name}</h4>
                          <div className="flex gap-2">
                            <Badge variant="outline">{angle.funnelStage.toUpperCase()}</Badge>
                            <Badge>{angle.priority}</Badge>
                          </div>
                        </div>
                        <p className="text-muted-foreground mb-4">{angle.description}</p>
                        <p className="mb-4">
                          <strong>Target Emotion:</strong> {angle.targetEmotion}
                        </p>
                        <div>
                          <p className="font-medium mb-2">Example Hooks:</p>
                          <ul className="space-y-2">
                            {safeArray(angle.exampleHooks).slice(0, 3).map((hook, j) => (
                              <li key={j} className="italic text-muted-foreground pl-4 border-l-2 border-primary/30">
                                &ldquo;{hook}&rdquo;
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </SubSection>
                <SubSection title="Expected Winners">
                  <div className="grid gap-4 md:grid-cols-2">
                    {creativeStrategy.expectedWinners.map((winner, i) => (
                      <div key={i} className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{winner.angle}</span>
                          <Badge variant="secondary">
                            {winner.confidenceLevel}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">{winner.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </SubSection>
              </div>
            </Section>

            {/* Section 8: Campaign Structure */}
            <Section
              title={SECTION_LABELS.campaignStructure}
              icon={SECTION_ICONS.campaignStructure}
              sectionNumber={8}
            >
              <div className="space-y-6">
                <p className="text-muted-foreground mb-6">
                  {campaignStructure.accountStructureOverview}
                </p>
                <div className="grid gap-6 md:grid-cols-3">
                  <SubSection title="Cold Campaigns">
                    <div className="space-y-3">
                      {campaignStructure.coldStructure.map((segment, i) => (
                        <div key={i} className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
                          <p className="font-medium">{segment.name}</p>
                          <p className="text-sm text-muted-foreground">{segment.budgetAllocation}% budget</p>
                        </div>
                      ))}
                    </div>
                  </SubSection>
                  <SubSection title="Warm Campaigns">
                    <div className="space-y-3">
                      {campaignStructure.warmStructure.map((segment, i) => (
                        <div key={i} className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                          <p className="font-medium">{segment.name}</p>
                          <p className="text-sm text-muted-foreground">{segment.budgetAllocation}% budget</p>
                        </div>
                      ))}
                    </div>
                  </SubSection>
                  <SubSection title="Hot Campaigns">
                    <div className="space-y-3">
                      {campaignStructure.hotStructure.map((segment, i) => (
                        <div key={i} className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                          <p className="font-medium">{segment.name}</p>
                          <p className="text-sm text-muted-foreground">{segment.budgetAllocation}% budget</p>
                        </div>
                      ))}
                    </div>
                  </SubSection>
                </div>
                <SubSection title="Naming Conventions">
                  <div className="rounded-lg bg-muted/30 p-5 font-mono text-sm space-y-2">
                    <p><strong>Campaign:</strong> {campaignStructure.namingConventions.campaignPattern}</p>
                    <p className="text-muted-foreground">Example: {campaignStructure.namingConventions.campaignExample}</p>
                  </div>
                </SubSection>
              </div>
            </Section>

            {/* Section 9: KPIs */}
            <Section
              title={SECTION_LABELS.kpisAndPerformanceModel}
              icon={SECTION_ICONS.kpisAndPerformanceModel}
              sectionNumber={9}
            >
              <div className="space-y-6">
                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-2">North Star Metric</p>
                  <p className="text-2xl font-bold mb-1">{kpisAndPerformanceModel.northStarMetric.metric}</p>
                  <p className="text-xl text-primary font-semibold">{kpisAndPerformanceModel.northStarMetric.target}</p>
                </div>
                <SubSection title="Primary KPIs">
                  <div className="grid gap-4 md:grid-cols-2">
                    {kpisAndPerformanceModel.primaryKpis.map((kpi, i) => (
                      <div key={i} className="rounded-lg border p-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{kpi.metric}</span>
                          <Badge variant="outline">{kpi.reportingFrequency}</Badge>
                        </div>
                        <p className="text-3xl font-bold text-primary mb-1">{kpi.target}</p>
                        <p className="text-sm text-muted-foreground">Benchmark: {kpi.benchmark}</p>
                      </div>
                    ))}
                  </div>
                </SubSection>
                <SubSection title="CAC Model">
                  <div className="rounded-lg bg-muted/30 p-5">
                    <p className="text-2xl font-bold mb-4">
                      Target CAC: ${kpisAndPerformanceModel.cacModel.targetCac}
                    </p>
                    <p className="font-medium mb-2">Optimization Levers:</p>
                    <ul className="space-y-2">
                      {safeArray(kpisAndPerformanceModel.cacModel?.optimizationLevers).map((lever, i) => (
                        <ListItem key={i}>{lever}</ListItem>
                      ))}
                    </ul>
                  </div>
                </SubSection>
              </div>
            </Section>

            {/* Section 10: Budget */}
            <Section
              title={SECTION_LABELS.budgetAllocationAndScaling}
              icon={SECTION_ICONS.budgetAllocationAndScaling}
              sectionNumber={10}
            >
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-lg border p-6">
                    <p className="text-sm text-muted-foreground mb-1">Monthly Budget</p>
                    <p className="text-4xl font-bold">
                      ${budgetAllocationAndScaling.initialBudget.totalMonthly.toLocaleString()}
                    </p>
                    <p className="text-muted-foreground">
                      ${budgetAllocationAndScaling.initialBudget.daily.toLocaleString()}/day
                    </p>
                  </div>
                  <div className="rounded-lg border p-6">
                    <p className="text-sm text-muted-foreground mb-1">Testing Phase</p>
                    <p className="text-2xl font-bold">
                      ${budgetAllocationAndScaling.initialBudget.testingPhase.budget.toLocaleString()}
                    </p>
                    <p className="text-muted-foreground">{budgetAllocationAndScaling.initialBudget.testingPhase.duration}</p>
                  </div>
                </div>
                <SubSection title="Platform Allocation">
                  <div className="space-y-4">
                    {budgetAllocationAndScaling.platformAllocation.map((allocation) => (
                      <div key={allocation.platform} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="capitalize font-medium">{allocation.platform.replace(/_/g, " ")}</span>
                          <span className="font-semibold">
                            ${allocation.amount.toLocaleString()} ({allocation.percentage}%)
                          </span>
                        </div>
                        <Progress value={allocation.percentage} className="h-3" />
                      </div>
                    ))}
                  </div>
                </SubSection>
                <SubSection title="Scaling Rules">
                  <div className="space-y-4">
                    {budgetAllocationAndScaling.scalingRules.map((rule, i) => (
                      <div key={i} className="rounded-lg border p-5">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium text-lg">{rule.name}</span>
                          <Badge
                            variant={
                              rule.riskLevel === "low"
                                ? "secondary"
                                : rule.riskLevel === "medium"
                                  ? "outline"
                                  : "destructive"
                            }
                          >
                            {rule.riskLevel} risk
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mb-2">
                          <strong>Trigger:</strong> {rule.trigger}
                        </p>
                        <p>
                          <strong>Action:</strong> {rule.action}
                        </p>
                      </div>
                    ))}
                  </div>
                </SubSection>
              </div>
            </Section>

            {/* Section 11: Risks */}
            <Section
              title={SECTION_LABELS.risksAndMitigation}
              icon={SECTION_ICONS.risksAndMitigation}
              sectionNumber={11}
            >
              <div className="space-y-6">
                <SubSection title="Top Risks">
                  <div className="space-y-4">
                    {risksAndMitigation.topRisks.map((risk) => (
                      <div
                        key={risk.id}
                        className={cn(
                          "rounded-lg border p-5",
                          risk.severity === "critical" && "border-red-500/50 bg-red-500/5",
                          risk.severity === "high" && "border-orange-500/50 bg-orange-500/5",
                          risk.severity === "medium" && "border-yellow-500/50 bg-yellow-500/5",
                          risk.severity === "low" && "border-green-500/50 bg-green-500/5"
                        )}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{risk.id}</Badge>
                            <span className="font-medium text-lg">{risk.category}</span>
                          </div>
                          <div className="flex gap-2">
                            <Badge
                              variant={
                                risk.severity === "critical" || risk.severity === "high"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {risk.severity}
                            </Badge>
                            <Badge variant="outline">{risk.likelihood}</Badge>
                          </div>
                        </div>
                        <p className="mb-3">{risk.description}</p>
                        <p className="text-muted-foreground">
                          <strong>Impact:</strong> {risk.impact}
                        </p>
                      </div>
                    ))}
                  </div>
                </SubSection>
                <SubSection title="Mitigation Steps">
                  <div className="grid gap-4 md:grid-cols-2">
                    {risksAndMitigation.mitigationSteps.map((step, i) => (
                      <div key={i} className="rounded-lg border p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Badge variant="outline">{step.riskId}</Badge>
                          <Badge variant="secondary">{step.timing}</Badge>
                        </div>
                        <p>{step.action}</p>
                      </div>
                    ))}
                  </div>
                </SubSection>
                <SubSection title="Dependencies">
                  <div className="grid gap-4 md:grid-cols-2">
                    {risksAndMitigation.dependencies.map((dep, i) => (
                      <div key={i} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{dep.name}</span>
                          <Badge
                            variant={
                              dep.status === "met"
                                ? "default"
                                : dep.status === "in_progress"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {dep.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">{dep.description}</p>
                      </div>
                    ))}
                  </div>
                </SubSection>
              </div>
            </Section>

            {/* Document Footer */}
            <div className="mt-16 pt-8 border-t border-border text-center text-sm text-muted-foreground">
              <p>Generated by AI Media Plan Generator</p>
              <p className="mt-1">Version {metadata.version}</p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
