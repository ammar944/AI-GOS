"use client";

import type { CSSProperties } from "react";
import { GradientBorder } from "@/components/ui/gradient-border";
import { StreamingCursor } from "./streaming-cursor";

interface DocumentEditorProps {
  content: string;
  filename?: string;
  isStreaming?: boolean;
  className?: string;
  /** Optional function to apply syntax highlighting to each line */
  highlightLine?: (line: string) => CSSProperties;
}

// Traffic lights component (macOS window controls)
function WindowChrome({ filename }: { filename: string }) {
  return (
    <div
      style={{
        padding: "14px 20px",
        background: "linear-gradient(180deg, #141414, #0a0a0a)",
        borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.04))",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Traffic lights */}
        <div style={{ display: "flex", gap: 8 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#ff5f57",
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#febc2e",
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#28c840",
            }}
          />
        </div>

        {/* Filename tab */}
        <div
          style={{
            padding: "6px 12px",
            background: "var(--bg-hover, rgba(255,255,255,0.05))",
            borderRadius: 6,
            fontSize: 12,
            color: "var(--text-tertiary, #666666)",
            fontFamily: '"Geist Mono", ui-monospace, monospace',
          }}
        >
          {filename}
        </div>
      </div>
    </div>
  );
}

// Line numbers column component
function LineNumbers({ lineCount }: { lineCount: number }) {
  return (
    <div
      style={{
        padding: 20,
        borderRight: "1px solid var(--border-subtle, rgba(255,255,255,0.04))",
        fontFamily: '"Geist Mono", ui-monospace, monospace',
        fontSize: 12,
        color: "var(--text-quaternary, #444444)",
        textAlign: "right",
        userSelect: "none",
        background: "rgba(255,255,255,0.01)",
        lineHeight: 1.8,
      }}
    >
      {Array.from({ length: lineCount }, (_, i) => (
        <div key={i + 1}>{i + 1}</div>
      ))}
    </div>
  );
}

export function DocumentEditor({
  content,
  filename = "blueprint.md",
  isStreaming = false,
  className,
  highlightLine,
}: DocumentEditorProps) {
  const lines = content.split("\n");
  const lineCount = lines.length;

  return (
    <GradientBorder animate={isStreaming} className={className}>
      <div style={{ borderRadius: 15, overflow: "hidden" }}>
        {/* Window chrome */}
        <WindowChrome filename={filename} />

        {/* Editor content with line numbers */}
        <div style={{ display: "flex", minHeight: 450 }}>
          {/* Line numbers column */}
          <LineNumbers lineCount={lineCount} />

          {/* Code content */}
          <div
            style={{
              flex: 1,
              padding: 20,
              fontFamily: '"Geist Mono", ui-monospace, monospace',
              fontSize: 13,
              lineHeight: 1.8,
              color: "var(--text-secondary, #a0a0a0)",
              overflow: "auto",
            }}
          >
            {lines.map((line, index) => {
              // Apply syntax highlighting if provided
              const lineStyle = highlightLine ? highlightLine(line) : {};
              return (
                <div key={index} style={lineStyle}>
                  {line || "\u00A0"}
                  {/* Show streaming cursor at end of last line when streaming */}
                  {isStreaming && index === lines.length - 1 && <StreamingCursor />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </GradientBorder>
  );
}
