import type { UIMessage } from 'ai';
import type {
  DeepResearchResult,
  ComparisonResult,
  AnalysisResult,
  VisualizationResult,
} from '@/lib/ai/chat-tools/types';

// =============================================================================
// Types
// =============================================================================

export interface ExportMetadata {
  blueprintTitle?: string;
  exportDate?: string;
}

/** Internal ToolPart shape used for formatting */
interface ToolPart {
  type: string;
  state: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/** Strip <think>...</think> blocks from text content */
function stripThinkingBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/** Format ISO date string or today's date as human-readable */
function formatDate(isoDate?: string): string {
  const d = isoDate ? new Date(isoDate) : new Date();
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Build a markdown table from headers + rows.
 * Each row is an object keyed by header name.
 */
function buildMarkdownTable(
  headers: string[],
  rows: Record<string, string>[]
): string {
  if (headers.length === 0 || rows.length === 0) return '';

  const headerRow = `| ${headers.join(' | ')} |`;
  const dividerRow = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = rows.map(
    (row) => `| ${headers.map((h) => String(row[h] ?? '')).join(' | ')} |`
  );

  return [headerRow, dividerRow, ...dataRows].join('\n');
}

/**
 * Format a single tool part result into markdown blockquote text.
 * Returns an empty string for non-output states (streaming/loading/approval).
 */
function formatToolPart(toolPart: ToolPart): string {
  // Skip all non-completed states
  if (toolPart.state !== 'output-available') return '';

  const toolName = toolPart.type.replace('tool-', '');
  const output = toolPart.output;
  if (!output) return '';

  // ------------------------------------------------------------------
  // tool-editBlueprint
  // ------------------------------------------------------------------
  if (toolName === 'editBlueprint') {
    if (output.error) return '';
    const section = String(output.section ?? '');
    const fieldPath = String(output.fieldPath ?? '');
    return `> **Edit Applied:** ${section}${fieldPath ? ` / ${fieldPath}` : ''}`;
  }

  // ------------------------------------------------------------------
  // tool-deepResearch
  // ------------------------------------------------------------------
  if (toolName === 'deepResearch') {
    if (output.error) return '';
    const data = output as unknown as DeepResearchResult;
    const lines: string[] = [];

    lines.push(`> **Deep Research: ${data.query ?? 'Unknown query'}**`);

    if (data.findings && data.findings.length > 0) {
      data.findings.forEach((finding) => {
        lines.push(`>`);
        lines.push(`> **${finding.title}**`);
        // Wrap finding content in blockquote lines
        const contentLines = finding.content.split('\n').filter(Boolean);
        contentLines.forEach((line) => lines.push(`> ${line}`));

        if (finding.citations && finding.citations.length > 0) {
          const citationList = finding.citations
            .map((c) => `[${c.label}](${c.url})`)
            .join(', ');
          lines.push(`> *Citations: ${citationList}*`);
        }
      });
    }

    if (data.sources && data.sources.length > 0) {
      const domainList = data.sources.map((s) => s.domain).join(', ');
      lines.push(`>`);
      lines.push(`> *Sources: ${domainList}*`);
    }

    return lines.join('\n');
  }

  // ------------------------------------------------------------------
  // tool-webResearch
  // ------------------------------------------------------------------
  if (toolName === 'webResearch') {
    if (!output.research) return '';
    const research = String(output.research);
    const lines: string[] = [];
    lines.push(`> **Web Research**`);
    lines.push(`>`);
    // Wrap each line in a blockquote
    research
      .split('\n')
      .filter(Boolean)
      .forEach((line) => lines.push(`> ${line}`));
    return lines.join('\n');
  }

  // ------------------------------------------------------------------
  // tool-searchBlueprint
  // ------------------------------------------------------------------
  if (toolName === 'searchBlueprint') {
    const sources = Array.isArray(output.sources) ? output.sources : [];
    const confidence = String(output.confidence ?? 'unknown');
    if (sources.length === 0) return '';
    return `> **Blueprint Search:** Found ${sources.length} source${sources.length !== 1 ? 's' : ''} (${confidence} confidence)`;
  }

  // ------------------------------------------------------------------
  // tool-explainBlueprint
  // ------------------------------------------------------------------
  if (toolName === 'explainBlueprint') {
    const explanation = String(output.explanation ?? output.text ?? '');
    if (!explanation) return '';
    const lines: string[] = [];
    lines.push(`> **Explanation**`);
    lines.push(`>`);
    explanation
      .split('\n')
      .filter(Boolean)
      .forEach((line) => lines.push(`> ${line}`));
    return lines.join('\n');
  }

  // ------------------------------------------------------------------
  // tool-generateSection
  // ------------------------------------------------------------------
  if (toolName === 'generateSection') {
    if (output.error) return '';
    const section = String(output.section ?? '');
    const instruction = String(output.instruction ?? '');
    return `> **Section Generated:** ${section}${instruction ? ` — "${instruction}"` : ''}`;
  }

  // ------------------------------------------------------------------
  // tool-compareCompetitors
  // ------------------------------------------------------------------
  if (toolName === 'compareCompetitors') {
    if (output.error) return '';
    const data = output as unknown as ComparisonResult;
    const lines: string[] = [];

    lines.push(`> **Competitor Comparison**`);

    if (data.headers && data.rows && data.rows.length > 0) {
      lines.push(`>`);
      // Build table — prefix each table line with "> " for blockquote
      const tableLines = buildMarkdownTable(data.headers, data.rows).split('\n');
      tableLines.forEach((line) => lines.push(`> ${line}`));
    }

    return lines.join('\n');
  }

  // ------------------------------------------------------------------
  // tool-analyzeMetrics
  // ------------------------------------------------------------------
  if (toolName === 'analyzeMetrics') {
    if (output.error) return '';
    const data = output as unknown as AnalysisResult;
    const lines: string[] = [];

    lines.push(
      `> **Analysis Score: ${data.section ?? 'Blueprint'}** — ${data.overallScore ?? '?'}/10`
    );

    if (data.summary) {
      lines.push(`>`);
      lines.push(`> ${data.summary}`);
    }

    if (data.dimensions && data.dimensions.length > 0) {
      lines.push(`>`);
      data.dimensions.forEach((dim) => {
        const reasoning = dim.reasoning ? ` — ${dim.reasoning}` : '';
        lines.push(`> - **${dim.name}:** ${dim.score}/10${reasoning}`);
      });
    }

    if (data.recommendations && data.recommendations.length > 0) {
      lines.push(`>`);
      lines.push(`> **Recommendations:**`);
      data.recommendations.forEach((rec) => {
        lines.push(`> - ${rec}`);
      });
    }

    return lines.join('\n');
  }

  // ------------------------------------------------------------------
  // tool-createVisualization
  // ------------------------------------------------------------------
  if (toolName === 'createVisualization') {
    if (output.error) return '';
    const data = output as unknown as VisualizationResult;
    const lines: string[] = [];

    lines.push(`> **Visualization: ${data.title ?? 'Chart'}**`);

    if (data.data && data.data.length > 0 && data.data[0] && typeof data.data[0] === 'object') {
      lines.push(`>`);
      // Derive headers from the first row's keys
      const headers = Object.keys(data.data[0]);
      const rows = data.data.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [k, String(v)])
        ) as Record<string, string>
      );
      const tableLines = buildMarkdownTable(headers, rows).split('\n');
      tableLines.forEach((line) => lines.push(`> ${line}`));
    }

    return lines.join('\n');
  }

  return '';
}

/**
 * Format a single UIMessage into markdown text.
 * Returns an empty string if the message has no renderable content.
 */
function formatMessage(message: UIMessage): string {
  const lines: string[] = [];

  for (const part of message.parts) {
    if (part.type === 'text') {
      const cleaned = stripThinkingBlocks(part.text);
      if (cleaned) lines.push(cleaned);
      continue;
    }

    if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
      const toolPart = part as unknown as ToolPart;
      const formatted = formatToolPart(toolPart);
      if (formatted) lines.push(formatted);
    }
  }

  return lines.join('\n\n');
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Convert a UIMessage array into a well-formatted Markdown string.
 * Skips messages that have no renderable content after processing.
 */
export function exportToMarkdown(
  messages: UIMessage[],
  metadata?: ExportMetadata
): string {
  const title = metadata?.blueprintTitle || 'Untitled';
  const date = formatDate(metadata?.exportDate);

  const sections: string[] = [];

  // Document header
  sections.push(`# Blueprint Chat — ${title}`);
  sections.push(`*Exported ${date}*`);
  sections.push('---');

  // Message blocks
  for (const message of messages) {
    const content = formatMessage(message);
    if (!content) continue;

    const prefix = message.role === 'user' ? '**You:**' : '**AIGOS:**';
    sections.push(`${prefix}\n\n${content}`);
    sections.push('---');
  }

  return sections.join('\n\n');
}

/**
 * Copy the chat conversation as Markdown to the clipboard.
 * Returns a Promise that rejects on clipboard access failure.
 */
export async function exportToClipboard(
  messages: UIMessage[],
  metadata?: ExportMetadata
): Promise<void> {
  const markdown = exportToMarkdown(messages, metadata);
  await navigator.clipboard.writeText(markdown);
}

/**
 * Trigger a browser file download with the given string content.
 * Creates a temporary anchor element, clicks it, then cleans up.
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  // Clean up after a short delay to ensure the download initiates
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(anchor);
  }, 100);
}
