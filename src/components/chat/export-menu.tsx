'use client';

import { useState } from 'react';
import { Download, FileText, Copy, FileDown, Check } from 'lucide-react';
import type { UIMessage } from 'ai';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { exportToMarkdown, exportToClipboard, downloadFile } from '@/lib/chat/export';

// =============================================================================
// Types
// =============================================================================

export interface ExportMenuProps {
  messages: UIMessage[];
  blueprintTitle?: string;
  disabled?: boolean;
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/** Build a datestamp string suitable for filenames: "2026-02-26" */
function fileDateStamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// =============================================================================
// Component
// =============================================================================

export function ExportMenu({
  messages,
  blueprintTitle,
  disabled,
  className,
}: ExportMenuProps) {
  const [copied, setCopied] = useState(false);

  const isEmpty = messages.length === 0;
  const isDisabled = disabled || isEmpty;

  function handleExportMarkdown() {
    const metadata = { blueprintTitle, exportDate: new Date().toISOString() };
    const markdown = exportToMarkdown(messages, metadata);
    const filename = `chat-export-${fileDateStamp()}.md`;
    downloadFile(markdown, filename, 'text/markdown;charset=utf-8');
  }

  async function handleCopyAll() {
    if (copied) return;
    try {
      const metadata = { blueprintTitle, exportDate: new Date().toISOString() };
      await exportToClipboard(messages, metadata);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={isDisabled}
          aria-label="Export chat"
          title={isEmpty ? 'No messages to export' : 'Export conversation'}
          className={cn('export-menu-trigger', className)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: 'none',
            background: 'transparent',
            color: isDisabled ? 'var(--text-quaternary)' : 'var(--text-tertiary)',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            transition: 'color 0.15s ease',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            if (!isDisabled) {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isDisabled) {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)';
            }
          }}
        >
          <Download style={{ width: '14px', height: '14px' }} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          padding: '4px',
          minWidth: '180px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}
        // Override the default Tailwind classes that would otherwise apply
        // bg-popover / rounded-md etc. from shadcn default styles
        className="!bg-[var(--bg-elevated)] !border-[var(--border-default)] !rounded-[10px] !p-1"
      >
        {/* Export as Markdown */}
        <DropdownMenuItem
          onClick={handleExportMarkdown}
          style={{
            fontSize: '12px',
            padding: '8px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            gap: '8px',
          }}
          className="!text-[12px] !rounded-[6px] focus:!bg-[var(--bg-hover)] focus:!text-[var(--text-primary)]"
        >
          <FileText style={{ width: '13px', height: '13px', flexShrink: 0 }} />
          Export as Markdown
        </DropdownMenuItem>

        {/* Copy all messages */}
        <DropdownMenuItem
          onClick={handleCopyAll}
          style={{
            fontSize: '12px',
            padding: '8px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            color: copied ? 'var(--accent-green)' : 'var(--text-secondary)',
            gap: '8px',
          }}
          className="!text-[12px] !rounded-[6px] focus:!bg-[var(--bg-hover)] focus:!text-[var(--text-primary)]"
        >
          {copied ? (
            <Check style={{ width: '13px', height: '13px', flexShrink: 0, color: 'var(--accent-green)' }} />
          ) : (
            <Copy style={{ width: '13px', height: '13px', flexShrink: 0 }} />
          )}
          {copied ? 'Copied!' : 'Copy all messages'}
        </DropdownMenuItem>

        <DropdownMenuSeparator
          style={{ background: 'var(--border-subtle)', margin: '4px 0' }}
          className="!bg-[var(--border-subtle)]"
        />

        {/* Export as PDF — coming soon */}
        <DropdownMenuItem
          disabled
          style={{
            fontSize: '12px',
            padding: '8px 12px',
            borderRadius: '6px',
            cursor: 'not-allowed',
            color: 'var(--text-quaternary)',
            gap: '8px',
            opacity: 0.5,
          }}
          className="!text-[12px] !rounded-[6px]"
        >
          <FileDown style={{ width: '13px', height: '13px', flexShrink: 0 }} />
          <span>Export as PDF</span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '10px',
              color: 'var(--text-quaternary)',
              whiteSpace: 'nowrap',
            }}
          >
            coming soon
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
