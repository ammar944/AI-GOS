'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { springs, staggerContainer, staggerItem } from '@/lib/motion';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useShell } from '@/components/shell/shell-provider';

const SIDEBAR_EXPANDED = 220;
const SIDEBAR_COLLAPSED = 48;
const RIGHT_PANEL_WIDTH = 320;

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  rightPanel?: ReactNode;
  className?: string;
}

export function AppShell({ sidebar, children, rightPanel, className }: AppShellProps) {
  const { sidebarCollapsed, rightPanelCollapsed } = useShell();

  const isDesktop = useMediaQuery('(min-width: 1280px)');
  const isTablet = useMediaQuery('(min-width: 1024px)');

  // Sidebar: always visible >= 1024px, auto-collapses < 1280px
  const showSidebar = isTablet;
  const effectiveCollapsed = sidebarCollapsed || !isDesktop;
  const sidebarWidth = effectiveCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  // Right panel: hidden < 1024px, respects user collapse preference
  const showRightPanel = isTablet && !rightPanelCollapsed && !!rightPanel;

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className={cn('flex h-screen w-full overflow-hidden', className)}
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Left Sidebar */}
      {showSidebar && (
        <motion.aside
          variants={staggerItem}
          animate={{ width: sidebarWidth }}
          transition={springs.gentle}
          className="flex-shrink-0 flex flex-col h-full overflow-y-auto overflow-x-hidden"
          style={{
            borderRight: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)',
          }}
        >
          {sidebar}
        </motion.aside>
      )}

      {/* Center Workspace */}
      <motion.main
        variants={staggerItem}
        transition={springs.gentle}
        className="flex-1 flex flex-col h-full min-w-0"
        style={{ background: 'var(--bg-base)' }}
      >
        <div className="flex flex-col h-full w-full max-w-[720px] mx-auto">
          {children}
        </div>
      </motion.main>

      {/* Right Panel */}
      <AnimatePresence mode="wait">
        {showRightPanel && (
          <motion.aside
            key="right-panel"
            initial={{ opacity: 0, x: 40, width: 0 }}
            animate={{ opacity: 1, x: 0, width: RIGHT_PANEL_WIDTH }}
            exit={{ opacity: 0, x: 40, width: 0 }}
            transition={springs.gentle}
            className="flex-shrink-0 flex flex-col h-full overflow-y-auto overflow-x-hidden"
            style={{
              borderLeft: '1px solid var(--border-default)',
              background: 'var(--bg-elevated)',
            }}
          >
            {rightPanel}
          </motion.aside>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
