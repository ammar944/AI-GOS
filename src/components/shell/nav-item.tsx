'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

  // Use startsWith for future dynamic routes like /journey/[sessionId]
  // Special case: "/" should only match exactly to avoid matching all routes
  const isActive =
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(href + '/');

  // Compute background — active state only; hover handled by .interactive-row CSS
  const background = isActive ? 'var(--bg-glass-hover)' : 'transparent';

  // Compute text color — active state only; hover handled by CSS
  const color = isActive ? 'var(--text-primary)' : 'var(--text-tertiary)';

  // Icon color is accent-blue when active, otherwise inherits from parent
  const iconColor = isActive ? 'var(--accent-blue)' : 'currentColor';

  // Icon opacity: active = 1, default = 0.5
  const iconOpacity = isActive ? 1 : 0.5;

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
    transition: 'background var(--transition-normal), color var(--transition-normal)',
    opacity: locked ? 0.4 : 1,
    cursor: locked ? 'not-allowed' : 'pointer',
    // Reset default button appearance — outline handled by .focus-ring class
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
    transition: 'opacity var(--transition-fast), color var(--transition-fast)',
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

  const itemNode = locked ? (
    <button
      type="button"
      className="interactive-row focus-ring"
      style={containerStyle}
      aria-disabled="true"
      aria-label={label}
      onClick={(e) => e.preventDefault()}
    >
      {innerContent}
    </button>
  ) : (
    <Link
      href={href}
      className="interactive-row focus-ring"
      style={containerStyle}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
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
