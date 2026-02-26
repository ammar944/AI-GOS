'use client';

import { motion } from 'framer-motion';
import {
  Search,
  Globe,
  Lightbulb,
  Pencil,
  Loader2,
  RefreshCw,
  BarChart3,
  Activity,
  Eye,
  Calculator,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolConfig {
  label: string;
  description: string;
  icon: typeof Search;
  color: string;
}

const TOOL_CONFIG: Record<string, ToolConfig> = {
  searchBlueprint: {
    label: 'Searching blueprint',
    description: 'Finding relevant sections and data...',
    icon: Search,
    color: 'var(--accent-blue)',
  },
  editBlueprint: {
    label: 'Preparing edit',
    description: 'Analyzing section and generating changes...',
    icon: Pencil,
    color: '#f59e0b',
  },
  explainBlueprint: {
    label: 'Analyzing section',
    description: 'Building explanation with evidence...',
    icon: Lightbulb,
    color: 'var(--accent-cyan)',
  },
  webResearch: {
    label: 'Web research',
    description: 'Searching live data sources...',
    icon: Globe,
    color: 'var(--accent-blue)',
  },
  deepResearch: {
    label: 'Deep research',
    description: 'Running multi-step investigation...',
    icon: Search,
    color: 'var(--accent-blue)',
  },
  generateSection: {
    label: 'Generating section',
    description: 'Rewriting content with AI...',
    icon: RefreshCw,
    color: '#f59e0b',
  },
  compareCompetitors: {
    label: 'Comparing competitors',
    description: 'Building comparison matrix...',
    icon: BarChart3,
    color: 'var(--accent-purple)',
  },
  analyzeMetrics: {
    label: 'Analyzing metrics',
    description: 'Scoring across dimensions...',
    icon: Activity,
    color: 'var(--accent-cyan)',
  },
  createVisualization: {
    label: 'Creating chart',
    description: 'Extracting and formatting data...',
    icon: Eye,
    color: 'var(--accent-green)',
  },
  searchMediaPlan: {
    label: 'Searching media plan',
    description: 'Finding relevant sections and data...',
    icon: Search,
    color: 'var(--accent-blue)',
  },
  editMediaPlan: {
    label: 'Preparing edit',
    description: 'Analyzing section and generating changes...',
    icon: Pencil,
    color: '#f59e0b',
  },
  explainMediaPlan: {
    label: 'Analyzing section',
    description: 'Building explanation with evidence...',
    icon: Lightbulb,
    color: 'var(--accent-cyan)',
  },
  recalculate: {
    label: 'Running validation',
    description: 'Checking budget and KPI consistency...',
    icon: Calculator,
    color: 'var(--accent-green)',
  },
  simulateBudgetChange: {
    label: 'Simulating budget',
    description: 'Projecting outcomes for change...',
    icon: TrendingUp,
    color: 'var(--accent-purple)',
  },
};

const DEFAULT_CONFIG: ToolConfig = {
  label: 'Working',
  description: 'Processing your request...',
  icon: Loader2,
  color: 'var(--text-tertiary)',
};

/** Extract a short context string from tool args */
function getArgContext(toolName: string, args?: Record<string, unknown>): string | null {
  if (!args) return null;
  const maxLen = 48;
  const truncate = (s: string) => (s.length > maxLen ? s.slice(0, maxLen) + '\u2026' : s);

  if (toolName === 'searchBlueprint' && typeof args.query === 'string') {
    return truncate(args.query);
  }
  if (toolName === 'deepResearch' && typeof args.topic === 'string') {
    return truncate(args.topic);
  }
  if (toolName === 'webResearch' && typeof args.query === 'string') {
    return truncate(args.query);
  }
  return null;
}

interface ToolLoadingIndicatorProps {
  toolName: string;
  args?: Record<string, unknown>;
  className?: string;
}

export function ToolLoadingIndicator({ toolName, args, className }: ToolLoadingIndicatorProps) {
  const config = TOOL_CONFIG[toolName] ?? DEFAULT_CONFIG;
  const Icon = config.icon;
  const context = getArgContext(toolName, args);

  // Build a hex/rgba background from the color — we use inline style with opacity
  const iconBg = config.color.startsWith('var(')
    ? `color-mix(in srgb, ${config.color} 12%, transparent)`
    : `${config.color}1f`; // 12% opacity hex approximation

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.18 }}
      className={cn('flex items-center gap-2.5', className)}
      style={{
        padding: '10px 12px',
        borderRadius: '10px',
        background: 'var(--bg-hover)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Icon container with colored tinted background */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-md"
        style={{
          width: 28,
          height: 28,
          background: iconBg,
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Icon style={{ width: 13, height: 13, color: config.color }} />
        </motion.div>
      </div>

      {/* Text column */}
      <div className="flex-1 min-w-0">
        <p
          className="font-medium leading-tight truncate"
          style={{ fontSize: '12px', color: config.color }}
        >
          {config.label}
        </p>
        {context ? (
          <p
            className="truncate mt-0.5"
            style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}
          >
            {context}
          </p>
        ) : (
          <p
            className="truncate mt-0.5"
            style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}
          >
            {config.description}
          </p>
        )}
      </div>

      {/* Pulsing activity dot */}
      <motion.span
        className="flex-shrink-0 rounded-full"
        style={{ width: 6, height: 6, background: config.color }}
        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}
