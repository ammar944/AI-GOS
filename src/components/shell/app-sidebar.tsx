'use client';

import {
  Home,
  Compass,
  FileText,
  Rocket,
  Palette,
  Settings,
} from 'lucide-react';
import { useShell } from '@/components/shell/shell-provider';
import { NavItem } from '@/components/shell/nav-item';
import { SessionList } from '@/components/shell/session-list';
import { UserMenu } from '@/components/shell/user-menu';

const NAV_ITEMS = [
  { icon: Home,     label: 'Home',        href: '/' },
  { icon: Compass,  label: 'Journey',     href: '/journey' },
  { icon: FileText, label: 'Blueprints',  href: '/blueprints' },
  { icon: Rocket,   label: 'Ad Launcher', href: '/ads',       locked: true },
  { icon: Palette,  label: 'Creatives',   href: '/creatives', locked: true },
  { icon: Settings, label: 'Settings',    href: '/settings' },
] as const;

// ─── Logo ──────────────────────────────────────────────────────────────────────

interface LogoProps {
  collapsed: boolean;
}

function Logo({ collapsed }: LogoProps) {
  if (collapsed) {
    return (
      <div
        style={{
          padding: '16px 0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '14px',
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #fff 30%, #93c5fd 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            userSelect: 'none',
          }}
        >
          AI
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '16px 16px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          fontSize: '16px',
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #fff 30%, #93c5fd 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          userSelect: 'none',
        }}
      >
        AI-GOS
      </span>

      <span
        style={{
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-quaternary)',
          padding: '2px 6px',
          border: '1px solid var(--border-subtle)',
          borderRadius: '4px',
          userSelect: 'none',
          lineHeight: 1.4,
        }}
      >
        v2
      </span>
    </div>
  );
}

// ─── AppSidebar ────────────────────────────────────────────────────────────────

export function AppSidebar() {
  const { sidebarCollapsed } = useShell();
  const collapsed = sidebarCollapsed;

  return (
    <div className="flex flex-col h-full select-none">
      {/* Logo */}
      <Logo collapsed={collapsed} />

      {/* Navigation */}
      <nav aria-label="Main navigation" style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            icon={item.icon}
            label={item.label}
            href={item.href}
            locked={'locked' in item ? item.locked : false}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border-default)', margin: '8px 16px' }} />

      {/* Session List */}
      <SessionList collapsed={collapsed} />

      {/* Spacer */}
      <div className="flex-1" />

      {/* User Menu */}
      <UserMenu collapsed={collapsed} />
    </div>
  );
}
