/**
 * ArtifactCanvas — focused full-width markdown view for one artifact.
 *
 * PRD: gtm-conversational-canvas (T9)
 *
 * Read-only for v1. Write-mode (editing) is intentionally NOT wired here —
 * mutations flow through the chat orchestrator's patch_artifact tool, not
 * through a direct editor. The "raw MD" pane is a textarea so users can copy
 * the source, but onChange is uncontrolled (display-only).
 *
 * Layout: header + side-by-side panes (rendered ←→ raw). Back-to-chat link
 * routes to /gtm/[runId].
 */

"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GtmArtifact } from "@/lib/types/gtm-artifact";

interface ArtifactCanvasProps {
  artifact: GtmArtifact;
  runId: string;
  className?: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ArtifactCanvas({
  artifact,
  runId,
  className,
}: ArtifactCanvasProps): React.ReactElement {
  return (
    <div className={cn("flex h-full flex-col", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 font-mono text-[11px]"
          >
            <Link href={`/gtm/${runId}`}>← Back to chat</Link>
          </Button>
          <span className="font-mono text-[11px] uppercase tracking-[0.06em]">
            {artifact.skill}
          </span>
          <Badge
            variant="outline"
            className="font-mono text-[10px] tabular-nums"
          >
            v{artifact.version}
          </Badge>
          <Badge
            variant={
              artifact.source === "skill_output" ? "default" : "outline"
            }
            className="font-mono text-[10px]"
          >
            {artifact.source === "skill_output" ? "skill" : "patched"}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {formatDate(artifact.created_at)}
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
          read-only — patch via chat
        </span>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-px overflow-hidden bg-border md:grid-cols-2">
        <section
          aria-label="Rendered markdown"
          className="prose prose-sm prose-invert max-w-none overflow-auto bg-background p-4"
        >
          <ReactMarkdown>{artifact.content_md}</ReactMarkdown>
        </section>
        <section
          aria-label="Raw markdown"
          className="overflow-auto bg-background p-4"
        >
          <textarea
            readOnly
            value={artifact.content_md}
            className="h-full min-h-[400px] w-full resize-none border-0 bg-transparent font-mono text-[12px] leading-relaxed text-foreground outline-none"
            spellCheck={false}
          />
        </section>
      </div>
    </div>
  );
}
