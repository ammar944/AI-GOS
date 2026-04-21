'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, FileText, Building2, PanelLeftClose, PanelLeft, Users, ShieldCheck } from 'lucide-react';
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

const DEFAULT_NAV: NavEntry[] = [
  { icon: Home, label: 'Home', href: '/dashboard' },
  { icon: Compass, label: 'Journey', href: '/journey' },
  { icon: FileText, label: 'Research', href: '/research' },
  { icon: Building2, label: 'Profiles', href: '/profiles' },
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

interface MePayload {
  role?: string;
  primaryProfileId?: string | null;
  clientLocked?: boolean;
}

export function AppSidebar() {
  const shell = useOptionalShell();
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const [navItems, setNavItems] = useState<NavEntry[]>(DEFAULT_NAV);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok || cancelled) return;
        const me = (await res.json()) as MePayload;
        if (me.role === 'client' && me.clientLocked && me.primaryProfileId) {
          const pid = me.primaryProfileId;
          setNavItems([
            { icon: Home, label: 'Workspace', href: `/profiles/${pid}` },
            { icon: FileText, label: 'Research', href: '/research' },
            { icon: Building2, label: 'Profile', href: `/profiles/${pid}` },
          ]);
          return;
        }
        const next: NavEntry[] = [...DEFAULT_NAV];
        if (me.role === 'admin' || me.role === 'internal') {
          next.push({ icon: Users, label: 'Clients', href: '/internal/clients' });
        }
        if (me.role === 'admin') {
          next.push({ icon: ShieldCheck, label: 'Allowlist', href: '/internal/allowlist' });
        }
        if (!cancelled) setNavItems(next);
      } catch {
        if (!cancelled) setNavItems(DEFAULT_NAV);
      }
    })();
    return () => {
      cancelled = true;
    };
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
            <button
              type="button"
              onClick={toggleSidebar}
              title="Collapse sidebar"
              className="flex items-center justify-center w-7 h-7 rounded-md cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors duration-150 shrink-0 ml-1"
            >
              <PanelLeftClose size={15} />
            </button>
          </>
        ) : (
          /* Collapsed: logomark as expand trigger */
          <button
            type="button"
            onClick={toggleSidebar}
            title="Expand sidebar"
            className="flex items-center justify-center w-8 h-8 rounded-md cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors duration-150"
          >
            <PanelLeft size={16} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-2">
        {navItems.map((item) => (
          <SidebarLink key={`${item.label}-${item.href}`} item={item} expanded={expanded} />
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
