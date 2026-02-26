'use client';

import { motion } from 'framer-motion';
import { Search, Globe, Lightbulb, Pencil, Loader2, Calculator, TrendingUp, RefreshCw, BarChart3, Activity } from 'lucide-react';

const TOOL_CONFIG: Record<string, { label: string; icon: typeof Search }> = {
  searchBlueprint: { label: 'Searching blueprint...', icon: Search },
  editBlueprint: { label: 'Preparing edit...', icon: Pencil },
  explainBlueprint: { label: 'Analyzing...', icon: Lightbulb },
  webResearch: { label: 'Researching...', icon: Globe },
  deepResearch: { label: 'Deep researching...', icon: Search },
  generateSection: { label: 'Generating section...', icon: RefreshCw },
  compareCompetitors: { label: 'Comparing competitors...', icon: BarChart3 },
  analyzeMetrics: { label: 'Analyzing metrics...', icon: Activity },
  searchMediaPlan: { label: 'Searching media plan...', icon: Search },
  editMediaPlan: { label: 'Preparing edit...', icon: Pencil },
  explainMediaPlan: { label: 'Analyzing...', icon: Lightbulb },
  recalculate: { label: 'Running validation...', icon: Calculator },
  simulateBudgetChange: { label: 'Simulating...', icon: TrendingUp },
};

interface ToolLoadingIndicatorProps {
  toolName: string;
}

export function ToolLoadingIndicator({ toolName }: ToolLoadingIndicatorProps) {
  const config = TOOL_CONFIG[toolName] || { label: 'Working...', icon: Loader2 };
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="flex items-center gap-2 px-3 py-2 rounded-lg my-1"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <motion.div
        animate={{ rotate: toolName === 'webResearch' ? 0 : undefined, opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
      </motion.div>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {config.label}
      </span>
      <Loader2
        className="w-3 h-3 animate-spin ml-auto"
        style={{ color: 'var(--text-quaternary)' }}
      />
    </motion.div>
  );
}
