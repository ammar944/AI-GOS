import type { MeetingMeta, MeetingInsights } from './types';

const MEETING_TYPE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  demo: 'Demo',
  follow_up: 'Follow-up',
  closing: 'Closing',
  strategy: 'Strategy',
  kickoff: 'Kickoff',
  review: 'Review',
  other: 'Meeting',
};

export function buildMeetingIntelligenceBlock(
  meta: MeetingMeta,
  insights: MeetingInsights,
): string {
  const lines: string[] = [];

  const typeLabel = MEETING_TYPE_LABELS[meta.meetingType] ?? 'Meeting';
  lines.push('══ MEETING INTELLIGENCE ══');
  lines.push(
    `Source: ${meta.title} (${typeLabel}, ${new Date(meta.dateAdded).toLocaleDateString('en-US')})`,
  );

  lines.push('');
  lines.push(`Business Health: ${insights.businessHealthSummary}`);

  if (insights.painPoints.length > 0) {
    lines.push('');
    lines.push('Pain Points:');
    for (const p of insights.painPoints) {
      const quotePart = p.quote ? ` — "${p.quote}"` : '';
      lines.push(`- ${p.pain} (severity: ${p.severity})${quotePart}`);
    }
  }

  if (insights.budgetSignals.mentionedSpend || insights.budgetSignals.willingnessToPay) {
    lines.push('');
    const parts = [
      insights.budgetSignals.mentionedSpend,
      `sensitivity: ${insights.budgetSignals.priceSensitivity}`,
    ].filter(Boolean);
    lines.push(`Budget: ${parts.join(', ')}`);
    if (insights.budgetSignals.willingnessToPay) {
      lines.push(`  Willingness: ${insights.budgetSignals.willingnessToPay}`);
    }
  }

  if (insights.competitorMentions.length > 0) {
    lines.push('');
    lines.push('Competitors Mentioned:');
    for (const c of insights.competitorMentions) {
      lines.push(`- ${c.name} (${c.sentiment}): ${c.context}`);
    }
  }

  if (insights.buyingTriggers.length > 0) {
    lines.push('');
    lines.push('Buying Triggers:');
    for (const t of insights.buyingTriggers) {
      const quotePart = t.quote ? ` — "${t.quote}"` : '';
      lines.push(`- ${t.trigger} (urgency: ${t.urgency})${quotePart}`);
    }
  }

  if (insights.objections.length > 0) {
    lines.push('');
    lines.push('Objections:');
    for (const o of insights.objections) {
      const resPart = o.resolution ? ` → Resolution: ${o.resolution}` : '';
      lines.push(`- ${o.objection}${resPart}`);
    }
  }

  if (insights.currentMarketing.channels.length > 0) {
    lines.push('');
    const spend = insights.currentMarketing.monthlySpend
      ? `, spending ${insights.currentMarketing.monthlySpend}`
      : '';
    lines.push(
      `Current Marketing: ${insights.currentMarketing.channels.join(', ')}${spend}`,
    );
    if (insights.currentMarketing.whatWorks)
      lines.push(`  Working: ${insights.currentMarketing.whatWorks}`);
    if (insights.currentMarketing.whatFails)
      lines.push(`  Failing: ${insights.currentMarketing.whatFails}`);
  }

  if (insights.goalsAndOutcomes.primaryGoal) {
    lines.push('');
    const metrics = insights.goalsAndOutcomes.successMetrics
      ? `, success = ${insights.goalsAndOutcomes.successMetrics}`
      : '';
    lines.push(`Goals: ${insights.goalsAndOutcomes.primaryGoal}${metrics}`);
  }

  if (insights.notableQuotes.length > 0) {
    lines.push('');
    lines.push('Notable Quotes:');
    for (const q of insights.notableQuotes) {
      lines.push(`- "${q.quote}" — ${q.relevance}`);
    }
  }

  lines.push('══ END MEETING INTELLIGENCE ══');
  return lines.join('\n');
}

export function buildAllMeetingIntelBlocks(
  meetings: MeetingMeta[],
  extractedFieldsMap: Record<string, MeetingInsights>,
): string {
  const readyMeetings = meetings.filter(
    (m) => m.status === 'ready' && extractedFieldsMap[m.documentId],
  );
  if (readyMeetings.length === 0) return '';

  const blocks = readyMeetings
    .sort((a, b) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime())
    .map((meeting) =>
      buildMeetingIntelligenceBlock(meeting, extractedFieldsMap[meeting.documentId]),
    );

  return blocks.join('\n\n');
}
