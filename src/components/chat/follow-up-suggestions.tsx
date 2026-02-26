'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FollowUpSuggestionsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Generate contextual follow-up suggestion chips based on the last completed tool.
 */
export function generateFollowUpSuggestions(
  lastToolName?: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _lastToolOutput?: Record<string, unknown>
): string[] {
  if (!lastToolName) return [];

  switch (lastToolName) {
    case 'deepResearch':
      return ['Update blueprint with findings', 'Research deeper', 'Compare top competitors'];
    case 'webResearch':
      return ['Apply this to blueprint', 'Research more on this', 'Summarize key takeaways'];
    case 'editBlueprint':
      return ['Make another edit', 'Explain the change', 'Undo this edit'];
    case 'generateSection':
      return ['Refine this section', 'Generate another section', 'Analyze the result'];
    case 'compareCompetitors':
      return ['Focus on market leader', 'Find competitive gaps', 'Update positioning'];
    case 'analyzeMetrics':
      return ['Fix weakest dimension', 'Rewrite this section', 'Compare to competitor'];
    case 'searchBlueprint':
      return ['Edit this section', 'Explain the data', 'Research more'];
    case 'explainBlueprint':
      return ['Make an edit', 'Analyze deeper', 'Research alternatives'];
    case 'createVisualization':
      return ['Visualize another metric', 'Compare competitors', 'Analyze this data'];
    default:
      return [];
  }
}

export function FollowUpSuggestions({
  suggestions,
  onSelect,
  disabled = false,
  className,
}: FollowUpSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {suggestions.map((suggestion, index) => (
        <motion.button
          key={suggestion}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.08, duration: 0.2 }}
          onClick={() => !disabled && onSelect(suggestion)}
          disabled={disabled}
          className="flex-shrink-0 cursor-pointer transition-colors duration-150"
          style={{
            padding: '6px 11px',
            borderRadius: '8px',
            fontSize: '11.5px',
            fontWeight: 500,
            color: disabled ? 'var(--text-quaternary)' : 'var(--text-tertiary)',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-subtle)',
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
            lineHeight: 1.4,
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.borderColor = 'var(--accent-blue)';
              e.currentTarget.style.color = 'var(--accent-blue)';
              e.currentTarget.style.background = 'rgba(54,94,255,0.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.color = 'var(--text-tertiary)';
              e.currentTarget.style.background = 'var(--bg-base)';
            }
          }}
        >
          {suggestion}
        </motion.button>
      ))}
    </div>
  );
}
