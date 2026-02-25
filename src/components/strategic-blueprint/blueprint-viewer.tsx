"use client";

import { useCallback, useState } from "react";
import { Clock, Coins, BarChart3, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GradientBorder } from "@/components/ui/gradient-border";
import { DocumentEditor } from "@/components/editor/document-editor";
import { highlightLine } from "@/lib/syntax";
import { generateBlueprintMarkdown } from "@/lib/strategic-blueprint/markdown-generator";
import { DIVIDER_DOUBLE } from "@/lib/strategic-blueprint/formatters";
import {
  formatIndustryMarketOverview,
  formatIcpAnalysis,
  formatOfferAnalysis,
  formatCompetitorAnalysis,
  formatCrossAnalysis,
  formatKeywordIntelligence,
} from "@/lib/strategic-blueprint/section-formatters";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";

interface BlueprintViewerProps {
  strategicBlueprint: StrategicBlueprintOutput;
  isStreaming?: boolean;
}

/**
 * BlueprintViewer - Displays strategic blueprint in a premium document editor format
 *
 * Converts structured blueprint data to formatted text and displays it in the
 * DocumentEditor component with syntax highlighting.
 */
export function BlueprintViewer({ strategicBlueprint, isStreaming = false }: BlueprintViewerProps) {
  const {
    industryMarketOverview,
    icpAnalysisValidation,
    offerAnalysisViability,
    competitorAnalysis,
    crossAnalysisSynthesis,
    keywordIntelligence,
    metadata,
  } = strategicBlueprint;

  const [copied, setCopied] = useState(false);

  // Copy as markdown handler
  const handleCopy = useCallback(() => {
    const markdown = generateBlueprintMarkdown(strategicBlueprint);
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [strategicBlueprint]);

  // Format all sections into text content
  const formatContent = useCallback((): string => {
    const lines: string[] = [];

    // Header
    lines.push(DIVIDER_DOUBLE);
    lines.push("STRATEGIC BLUEPRINT");
    lines.push(DIVIDER_DOUBLE);
    lines.push("");
    lines.push(`Generated: ${new Date(metadata.generatedAt).toLocaleString()}`);
    lines.push(`Version: ${metadata.version}`);
    lines.push("");

    // Add each section
    if (industryMarketOverview) {
      lines.push(...formatIndustryMarketOverview(industryMarketOverview));
    }
    if (icpAnalysisValidation) {
      lines.push(...formatIcpAnalysis(icpAnalysisValidation));
    }
    if (offerAnalysisViability) {
      lines.push(...formatOfferAnalysis(offerAnalysisViability));
    }
    if (competitorAnalysis) {
      lines.push(...formatCompetitorAnalysis(competitorAnalysis));
    }
    if (crossAnalysisSynthesis) {
      lines.push(...formatCrossAnalysis(crossAnalysisSynthesis));
    }
    if (keywordIntelligence) {
      lines.push(...formatKeywordIntelligence(keywordIntelligence));
    }

    // Footer
    lines.push(DIVIDER_DOUBLE);
    lines.push(`Strategic Blueprint v${metadata.version}`);
    lines.push(`Generated on ${new Date(metadata.generatedAt).toLocaleDateString()}`);
    lines.push(DIVIDER_DOUBLE);

    return lines.join("\n");
  }, [
    industryMarketOverview,
    icpAnalysisValidation,
    offerAnalysisViability,
    competitorAnalysis,
    crossAnalysisSynthesis,
    keywordIntelligence,
    metadata,
  ]);

  const content = formatContent();

  return (
    <div className="w-full space-y-6">
      {/* Header with metadata and export */}
      <GradientBorder>
        <div
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6"
        >
          <div>
            <h1
              className="text-2xl font-bold"
              style={{
                color: 'var(--text-heading)',
                fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
                letterSpacing: '-0.02em',
              }}
            >
              Strategic Blueprint
            </h1>
            <div
              className="flex flex-wrap gap-4 text-sm mt-2"
              style={{
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans), Inter, sans-serif',
              }}
            >
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                Generated: {new Date(metadata.generatedAt).toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Coins className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                ${metadata.totalCost.toFixed(4)}
              </span>
              {metadata.overallConfidence != null && (
                <span className="flex items-center gap-1">
                  <BarChart3 className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                  Confidence: {metadata.overallConfidence}%
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 rounded-md transition-all duration-200"
                    style={{
                      border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'var(--border-default)'}`,
                      color: copied ? 'var(--success)' : 'var(--text-secondary)',
                      background: 'transparent',
                      fontFamily: 'var(--font-sans), Inter, sans-serif',
                    }}
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Copy full blueprint as markdown
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </GradientBorder>

      {/* Document Editor Display with GradientBorder */}
      <GradientBorder animate={isStreaming}>
        <DocumentEditor
          content={content}
          filename="strategic-blueprint.md"
          isStreaming={isStreaming}
          highlightLine={highlightLine}
        />
      </GradientBorder>
    </div>
  );
}
