'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Search, Pencil, GitCompare, BarChart3, Eye } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface SlashCommand {
  name: string;
  description: string;
  icon: string;
  color: string;
}

interface SlashCommandPaletteProps {
  commands: SlashCommand[];
  isOpen: boolean;
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Search,
  Pencil,
  GitCompare,
  BarChart3,
  Eye,
};

function CommandIcon({ name, color }: { name: string; color: string }) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={14} style={{ color }} />;
}

export function SlashCommandPalette({
  commands,
  isOpen,
  selectedIndex,
  onSelect,
}: SlashCommandPaletteProps) {
  return (
    <AnimatePresence>
      {isOpen && commands.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'absolute',
            bottom: '100%',
            marginBottom: '6px',
            left: 0,
            right: 0,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            padding: '4px',
            zIndex: 50,
          }}
        >
          {commands.map((command, index) => (
            <div
              key={command.name}
              onClick={() => onSelect(command)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: index === selectedIndex ? 'var(--bg-hover)' : 'transparent',
                transition: 'background 0.1s ease',
              }}
            >
              {/* Icon container */}
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: `${command.color}1a`,
                }}
              >
                <CommandIcon name={command.icon} color={command.color} />
              </div>

              {/* Text content */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    lineHeight: 1.3,
                  }}
                >
                  /{command.name}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    lineHeight: 1.3,
                  }}
                >
                  {command.description}
                </span>
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
