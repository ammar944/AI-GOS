'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, FileText, Building2, PanelLeftClose, PanelLeft } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { useOptionalShell } from '@/components/shell/shell-provider';

interface NavEntry {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  href: string;
}

const NAV_ITEMS: NavEntry[] = [
  { icon: Home, label: 'Home', href: '/dashboard' },
  { icon: Compass, label: 'Journey', href: '/journey' },
  { icon: FileText, label: 'Research', href: '/research' },
  { icon: Building2, label: 'Profiles', href: '/profiles' },
];

function SidebarLink({ item, expanded }: { item: NavEntry; expanded: boolean }): React.JSX.Element {
  const pathname = usePathname();
  const isActive =
    item.href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === item.href || pathname.startsWith(item.href + '/');

  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={expanded ? undefined : item.label}
      className={cn(
        'relative flex items-center gap-3 h-10 px-4 rounded-lg cursor-pointer transition-colors duration-150',
        isActive
          ? 'text-[var(--text-primary)] bg-[var(--bg-hover)]'
          : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[var(--text-primary)]" />
      )}
      <Icon size={18} className="shrink-0" />
      {expanded && (
        <span className="text-[13px] font-medium whitespace-nowrap">
          {item.label}
        </span>
      )}
    </Link>
  );
}

export function AppSidebar(): React.JSX.Element {
  const shell = useOptionalShell();
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Use shell context when available, otherwise fall back to local state
  const collapsed = shell?.sidebarCollapsed ?? localCollapsed;
  const expanded = !collapsed;
  const toggleSidebar = shell?.toggleSidebar ?? (() => setLocalCollapsed((c) => !c));

  return (
    <aside
      className={cn(
        'flex flex-col h-full transition-all duration-200 ease-out bg-[var(--bg-base)] border-r border-[var(--border-default)] py-4 shrink-0 overflow-hidden',
        expanded ? 'w-48' : 'w-14',
      )}
    >
      {/* Header row: Logo + Collapse toggle inline (Linear/Notion pattern) */}
      <div className={cn('flex items-center px-3 mb-4 h-10', expanded ? 'justify-between' : 'justify-center')}>
        {expanded ? (
          <>
            {/* Full logo when expanded */}
            <Link href="/dashboard" className="transition-opacity hover:opacity-80 flex items-center min-w-0">
              <Logo size="md" className="shadow-none" />
            </Link>

            {/* Collapse button — right side of header row */}
            <Button
              type="button"
              onClick={toggleSidebar}
              title="Collapse sidebar"
              variant="ghost"
              size="icon-sm"
              className="ml-1 shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              <PanelLeftClose size={15} />
            </Button>
          </>
        ) : (
          /* Collapsed: logomark as expand trigger */
          <Button
            type="button"
            onClick={toggleSidebar}
            title="Expand sidebar"
            variant="ghost"
            size="icon-sm"
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            <PanelLeft size={16} />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} expanded={expanded} />
        ))}
      </nav>

      {/* Bottom: Theme toggle + User */}
      <div className="mt-auto flex flex-col gap-1 px-2">
        <ThemeToggle expanded={expanded} />
        <div className={cn('flex items-center h-10', expanded ? 'px-4' : 'justify-center')}>
          {isMounted ? (
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'w-8 h-8',
                },
              }}
            />
          ) : (
            <div aria-hidden="true" className="h-8 w-8 rounded-full border bg-muted" />
          )}
        </div>
      </div>
    </aside>
  );
}
