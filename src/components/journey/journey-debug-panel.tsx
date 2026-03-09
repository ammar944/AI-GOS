'use client';

import type { UIMessage } from 'ai';
import { useMemo, type ReactNode } from 'react';
import {
  CANONICAL_RESEARCH_SECTION_ORDER,
  RESEARCH_SECTION_LABELS,
} from '@/lib/journey/research-sections';

export interface JourneyDebugEvent {
  id: string;
  at: string;
  type: string;
  detail: string;
  payload?: unknown;
}

interface JourneyDebugPanelProps {
  sessionId: string | null;
  chatStatus: string;
  errorMessage?: string;
  researchTimedOut: boolean;
  sectionStatuses: Record<string, 'queued' | 'running' | 'complete' | 'error'>;
  elapsedTimes: Record<string, number>;
  researchStreaming: Record<string, { text: string; status: 'running' | 'complete' | 'error'; startedAt?: number }>;
  messages: UIMessage[];
  events: JourneyDebugEvent[];
}

function formatJson(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function JourneyDebugPanel({
  sessionId,
  chatStatus,
  errorMessage,
  researchTimedOut,
  sectionStatuses,
  elapsedTimes,
  researchStreaming,
  messages,
  events,
}: JourneyDebugPanelProps) {
  const orderedSections = useMemo(() => {
    const canonicalSectionSet = new Set<string>(CANONICAL_RESEARCH_SECTION_ORDER);
    return [
      ...CANONICAL_RESEARCH_SECTION_ORDER.filter((sectionId) => sectionId in sectionStatuses),
      ...Object.keys(sectionStatuses).filter(
        (sectionId) => !canonicalSectionSet.has(sectionId),
      ),
    ];
  }, [sectionStatuses]);

  const toolTimeline = useMemo(() => messages.flatMap((message) =>
    message.role !== 'assistant'
      ? []
      : message.parts.flatMap((part) => {
        if (
          typeof part !== 'object' ||
          part == null ||
          typeof part.type !== 'string' ||
          !part.type.startsWith('tool-')
        ) {
          return [];
        }

        const record = part as Record<string, unknown>;
        return [{
          messageId: message.id,
          type: record.type as string,
          state: typeof record.state === 'string' ? record.state : 'unknown',
          toolCallId: typeof record.toolCallId === 'string' ? record.toolCallId : '',
          input: record.input,
          output: record.output,
          errorText: typeof record.errorText === 'string' ? record.errorText : undefined,
        }];
      }),
  ), [messages]);

  return (
    <div
      className="mt-4 rounded-2xl p-4"
      style={{
        background: 'rgba(10, 14, 26, 0.72)',
        border: '1px solid rgba(96, 165, 250, 0.22)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--accent-blue)',
        }}
      >
        Dev debug
      </div>

      <div className="mt-3 space-y-3">
        <DebugBlock title="Session">
          <DebugRow label="Session ID" value={sessionId ?? 'missing'} mono />
          <DebugRow label="Chat status" value={chatStatus} mono />
          <DebugRow label="Timed out" value={researchTimedOut ? 'true' : 'false'} mono />
          {errorMessage ? <DebugRow label="Error" value={errorMessage} mono /> : null}
        </DebugBlock>

        <DebugBlock title="Research State">
          {Object.keys(sectionStatuses).length === 0 ? (
            <EmptyLine text="No research sections tracked yet." />
          ) : (
            <div className="space-y-2">
              {orderedSections.map((sectionId) => {
                const state = sectionStatuses[sectionId];
                return (
                <div
                  key={sectionId}
                  className="rounded-xl px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <DebugRow
                    label="Section"
                    value={
                      RESEARCH_SECTION_LABELS[sectionId as keyof typeof RESEARCH_SECTION_LABELS]
                        ? `${sectionId} (${RESEARCH_SECTION_LABELS[sectionId as keyof typeof RESEARCH_SECTION_LABELS]})`
                        : sectionId
                    }
                    mono
                  />
                  <DebugRow label="State" value={state} mono />
                  <DebugRow
                    label="Elapsed"
                    value={elapsedTimes[sectionId] != null ? `${Math.floor(elapsedTimes[sectionId] / 1000)}s` : '-'}
                    mono
                  />
                  <DebugRow
                    label="Stream"
                    value={researchStreaming[sectionId]?.text?.slice(0, 180) || '-'}
                  />
                </div>
                );
              })}
            </div>
          )}
        </DebugBlock>

        <DebugBlock title="Tool Timeline">
          {toolTimeline.length === 0 ? (
            <EmptyLine text="No tool parts in the current message history." />
          ) : (
            <div className="space-y-2">
              {toolTimeline.map((tool, index) => (
                <details
                  key={`${tool.messageId}-${tool.toolCallId}-${index}`}
                  className="rounded-xl px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <summary
                    className="cursor-pointer list-none"
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}
                  >
                    {tool.type} [{tool.state}]
                  </summary>
                  <div className="mt-2 space-y-2">
                    <DebugRow label="Message" value={tool.messageId} mono />
                    <DebugRow label="Tool call" value={tool.toolCallId || '-'} mono />
                    {tool.errorText ? <DebugRow label="Error" value={tool.errorText} mono /> : null}
                    <CodeDump label="Input" value={formatJson(tool.input)} />
                    <CodeDump label="Output" value={formatJson(tool.output)} />
                  </div>
                </details>
              ))}
            </div>
          )}
        </DebugBlock>

        <DebugBlock title="Recent Events">
          {events.length === 0 ? (
            <EmptyLine text="No debug events captured yet." />
          ) : (
            <div className="space-y-2">
              {events.slice().reverse().map((event) => (
                <details
                  key={event.id}
                  className="rounded-xl px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <summary
                    className="cursor-pointer list-none"
                    style={{ fontSize: 12, color: 'var(--text-secondary)' }}
                  >
                    <span style={{ color: 'var(--accent-blue)' }}>{event.type}</span> {event.detail}
                  </summary>
                  <div className="mt-2">
                    <DebugRow label="At" value={event.at} mono />
                    {event.payload !== undefined ? (
                      <CodeDump label="Payload" value={formatJson(event.payload)} />
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          )}
        </DebugBlock>
      </div>
    </div>
  );
}

function DebugBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-secondary)',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function DebugRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
      <span
        className="break-all"
        style={{
          fontSize: 11,
          color: 'var(--text-primary)',
          fontFamily: mono ? 'var(--font-mono)' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function CodeDump({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
      <pre
        className="overflow-x-auto rounded-lg p-2 whitespace-pre-wrap break-words"
        style={{
          fontSize: 10,
          lineHeight: 1.5,
          color: 'var(--text-primary)',
          background: 'rgba(255,255,255,0.04)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {value || '-'}
      </pre>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{text}</div>;
}
