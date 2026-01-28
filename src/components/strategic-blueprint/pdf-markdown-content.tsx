'use client';

import { forwardRef, useMemo } from 'react';
import { generateBlueprintMarkdown } from '@/lib/strategic-blueprint/markdown-generator';
import type { StrategicBlueprintOutput } from '@/lib/strategic-blueprint/output-types';

interface PdfMarkdownContentProps {
  strategicBlueprint: StrategicBlueprintOutput;
}

/**
 * PdfMarkdownContent renders a strategic blueprint in a macOS dark theme document editor style.
 * Displays raw markdown text with line numbers, styled for PDF export compatibility.
 * Uses inline styles with hex values (no CSS variables) for PDF generation libraries.
 */
const PdfMarkdownContent = forwardRef<HTMLDivElement, PdfMarkdownContentProps>(
  function PdfMarkdownContent({ strategicBlueprint }, ref) {
    const markdown = useMemo(() => {
      return generateBlueprintMarkdown(strategicBlueprint);
    }, [strategicBlueprint]);

    const lines = markdown.split('\n');

    return (
      <div
        ref={ref}
        style={{
          fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '13px',
          lineHeight: 1.8,
          color: '#a0a0a0',
          backgroundColor: '#0a0a0a',
          borderRadius: 15,
          overflow: 'hidden',
        }}
      >
        {/* Window chrome header */}
        <div
          style={{
            padding: '14px 20px',
            background: 'linear-gradient(180deg, #141414, #0a0a0a)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Traffic lights */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#ff5f57',
                }}
              />
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#febc2e',
                }}
              />
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#28c840',
                }}
              />
            </div>

            {/* Filename tab */}
            <div
              style={{
                padding: '6px 12px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 6,
                fontSize: 12,
                color: '#666666',
                fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              }}
            >
              strategic-blueprint.md
            </div>
          </div>
        </div>

        {/* Editor content */}
        <div style={{ display: 'flex', minHeight: 450 }}>
          {/* Code content */}
          <div
            style={{
              flex: 1,
              padding: 20,
              fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 13,
              lineHeight: 1.8,
              color: '#a0a0a0',
              overflow: 'auto',
            }}
          >
            {lines.map((line, index) => {
              // Apply brighter colors for headings
              let lineStyle: React.CSSProperties = {};
              const trimmedLine = line.trim();

              if (trimmedLine.startsWith('# ')) {
                lineStyle = { color: '#ffffff', fontWeight: 600 };
              } else if (trimmedLine.startsWith('## ')) {
                lineStyle = { color: '#e0e0e0', fontWeight: 600 };
              } else if (trimmedLine.startsWith('### ')) {
                lineStyle = { color: '#c0c0c0', fontWeight: 500 };
              } else if (trimmedLine.startsWith('#### ')) {
                lineStyle = { color: '#b0b0b0', fontWeight: 500 };
              }

              return (
                <div key={index} style={lineStyle}>
                  {line || '\u00A0'}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);

export default PdfMarkdownContent;
