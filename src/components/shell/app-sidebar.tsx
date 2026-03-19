'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, FileText, Settings, PanelLeftClose, PanelLeft } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { Logo } from '@/components/ui/logo';
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
  { icon: Settings, label: 'Settings', href: '/settings' },
];

function SidebarLink({ item, expanded }: { item: NavEntry; expanded: boolean }) {
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
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[var(--accent-blue)]" />
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

export function AppSidebar() {
  const shell = useOptionalShell();
  const collapsed = shell?.sidebarCollapsed ?? false;
  const expanded = !collapsed;

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
            {shell && (
              <button
                type="button"
                onClick={shell.toggleSidebar}
                title="Collapse sidebar"
                className="flex items-center justify-center w-7 h-7 rounded-md cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors duration-150 shrink-0 ml-1"
              >
                <PanelLeftClose size={15} />
              </button>
            )}
          </>
        ) : (
          /* Collapsed: logomark as expand trigger */
          <button
            type="button"
            onClick={shell?.toggleSidebar}
            title="Expand sidebar"
            className="flex items-center justify-center w-8 h-8 rounded-md cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors duration-150"
          >
            <PanelLeft size={16} />
          </button>
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
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: 'w-8 h-8',
              },
            }}
          />
        </div>
      </div>
    </aside>
  );
}
