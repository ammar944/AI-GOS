"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MediaPlanBlueprint } from "@/lib/media-plan/types";

interface BlueprintDisplayProps {
  blueprint: MediaPlanBlueprint;
}

export function BlueprintDisplay({ blueprint }: BlueprintDisplayProps) {
  return (
    <div className="space-y-6">
      {/* Header with metadata */}
      <div className="text-center pb-4 border-b">
        <h1 className="text-2xl font-bold">Strategic Research Blueprint</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Generated on {new Date(blueprint.metadata.generatedAt).toLocaleDateString()} |
          Processing time: {(blueprint.metadata.processingTime / 1000).toFixed(1)}s |
          Cost: ${blueprint.metadata.totalCost.toFixed(4)}
        </p>
      </div>

      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Executive Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap leading-relaxed">{blueprint.executiveSummary}</p>
        </CardContent>
      </Card>

      {/* Platform Strategy */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Strategy</CardTitle>
          <CardDescription>Recommended advertising platforms and tactics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {blueprint.platformStrategy.map((platform, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{platform.platform}</h4>
                  <span className="text-sm font-medium text-primary">
                    ${platform.budget.toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{platform.rationale}</p>
                <div className="flex flex-wrap gap-1">
                  {platform.tactics.map((tactic, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 text-xs bg-muted rounded-full"
                    >
                      {tactic}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Budget Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Breakdown</CardTitle>
          <CardDescription>How your budget is allocated</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {blueprint.budgetBreakdown.map((item, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{item.category}</span>
                  <span className="text-sm">
                    ${item.amount.toLocaleString()} ({item.percentage}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                {item.notes && (
                  <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Funnel Strategy */}
      <Card>
        <CardHeader>
          <CardTitle>Funnel Strategy: {blueprint.funnelStrategy.type}</CardTitle>
          <CardDescription>Customer journey from awareness to conversion</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {blueprint.funnelStrategy.stages.map((stage, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  {index < blueprint.funnelStrategy.stages.length - 1 && (
                    <div className="w-0.5 h-full bg-border mt-2" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <h4 className="font-semibold">{stage.name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{stage.objective}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Channels: </span>
                      {stage.channels.map((channel, i) => (
                        <span key={i} className="text-xs">
                          {channel}{i < stage.channels.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {stage.content.map((content, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs bg-muted rounded">
                        {content}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Ad Angles */}
      <Card>
        <CardHeader>
          <CardTitle>Ad Angles & Messaging Hooks</CardTitle>
          <CardDescription>Creative approaches for your campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {blueprint.adAngles.map((angle, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold">{angle.angle}</h4>
                  <span className="px-2 py-0.5 text-xs bg-secondary text-secondary-foreground rounded">
                    {angle.targetEmotion}
                  </span>
                </div>
                <p className="text-sm font-medium text-primary mb-2">"{angle.hook}"</p>
                <p className="text-sm text-muted-foreground italic">Example: {angle.example}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* KPI Targets */}
      <Card>
        <CardHeader>
          <CardTitle>KPI Targets</CardTitle>
          <CardDescription>Key performance indicators to track</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Metric</th>
                  <th className="text-left py-2 font-medium">Target</th>
                  <th className="text-left py-2 font-medium">Benchmark</th>
                </tr>
              </thead>
              <tbody>
                {blueprint.kpiTargets.map((kpi, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="py-2">{kpi.metric}</td>
                    <td className="py-2 font-medium text-primary">{kpi.target}</td>
                    <td className="py-2 text-muted-foreground">{kpi.benchmark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sources */}
      {blueprint.sources && blueprint.sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Research Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {blueprint.sources.map((source, index) => (
                <li key={index} className="text-sm">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {source.title}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
