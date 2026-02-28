'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { type LucideIcon, Lock } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  locked?: boolean;
  collapsed: boolean;
}

export function NavItem({ icon: Icon, label, href, locked = false, collapsed }: NavItemProps) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);

  // Use startsWith for future dynamic routes like /journey/[sessionId]
  // Special case: "/" should only match exactly to avoid matching all routes
  const isActive =
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(href + '/');

  // Compute background
  let background = 'transparent';
  if (isActive) {
    background = 'rgba(54, 94, 255, 0.12)'; // --accent-blue-dim
  } else if (hovered && !locked) {
    background = 'var(--bg-hover)';
  }

  // Compute text color
  let color = 'var(--text-tertiary)';
  if (isActive) {
    color = 'var(--text-primary)';
  } else if (hovered && !locked) {
    color = 'var(--text-secondary)';
  }

  // Icon color is accent-blue when active, otherwise inherits from parent
  const iconColor = isActive ? 'var(--accent-blue)' : 'currentColor';

  // Icon opacity: active = 1, hover = 0.85, default = 0.6
  const iconOpacity = isActive ? 1 : hovered && !locked ? 0.85 : 0.6;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: collapsed ? 0 : '10px',
    padding: collapsed ? '8px' : '8px 10px',
    justifyContent: collapsed ? 'center' : undefined,
    borderRadius: '8px',
    color,
    background,
    fontSize: '13px',
    fontWeight: 400,
    textDecoration: 'none',
    border: 'none',
    width: '100%',
    textAlign: 'left' as const,
    transition: 'all 0.15s ease',
    opacity: locked ? 0.4 : 1,
    cursor: locked ? 'not-allowed' : 'pointer',
    // Reset default button appearance
    outline: 'none',
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
  };

  const iconWrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: '18px',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: iconColor,
    opacity: iconOpacity,
    transition: 'opacity 0.15s ease, color 0.15s ease',
  };

  const lockBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '-2px',
    right: '-2px',
    color: 'var(--text-tertiary)',
    // Lock icon is rendered at 12px via width/height on the SVG
    lineHeight: 0,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '13px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  };

  const innerContent = (
    <>
      <span style={iconWrapperStyle}>
        <Icon width={18} height={18} strokeWidth={1.5} />
        {locked && (
          <span style={lockBadgeStyle}>
            <Lock width={12} height={12} strokeWidth={2} />
          </span>
        )}
      </span>
      {!collapsed && <span style={labelStyle}>{label}</span>}
    </>
  );

  const sharedEventProps = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  const itemNode = locked ? (
    <button
      type="button"
      style={containerStyle}
      aria-disabled="true"
      aria-label={label}
      onClick={(e) => e.preventDefault()}
      {...sharedEventProps}
    >
      {innerContent}
    </button>
  ) : (
    <Link
      href={href}
      style={containerStyle}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      {...sharedEventProps}
    >
      {innerContent}
    </Link>
  );

  // Only show tooltip when collapsed (icon-only) or locked ("Coming soon")
  const needsTooltip = collapsed || locked;

  if (!needsTooltip) {
    return <span className={cn('block w-full')}>{itemNode}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('block w-full')}>
          {itemNode}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {locked ? 'Coming soon' : label}
      </TooltipContent>
    </Tooltip>
  );
}
