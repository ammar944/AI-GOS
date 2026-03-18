'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, FileText, Settings, PanelLeftClose, PanelLeft } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { LogoMark } from '@/components/ui/logo';
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
      {/* Logo */}
      <div className="flex items-center justify-center px-2 mb-6">
        <Link href="/dashboard" className="transition-opacity hover:opacity-80">
          <LogoMark size="md" className="shadow-none" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} expanded={expanded} />
        ))}
      </nav>

      {/* Theme toggle + Collapse + User — bottom */}
      <div className="mt-auto flex flex-col gap-2 px-2">
        {/* Theme toggle */}
        <div className={cn('flex items-center', expanded ? 'px-4' : 'justify-center')}>
          <ThemeToggle />
        </div>

        {shell && (
          <button
            type="button"
            onClick={shell.toggleSidebar}
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            className="flex items-center gap-3 h-10 px-4 rounded-lg cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors duration-150"
          >
            {expanded ? (
              <PanelLeftClose size={18} className="shrink-0" />
            ) : (
              <PanelLeft size={18} className="shrink-0" />
            )}
            {expanded && (
              <span className="text-[13px] font-medium whitespace-nowrap">
                Collapse
              </span>
            )}
          </button>
        )}
        <div className="flex items-center justify-center">
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
