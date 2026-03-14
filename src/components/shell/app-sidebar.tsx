'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, FileText, Settings } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { LogoMark } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

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

function SidebarLink({ item }: { item: NavEntry }) {
  const pathname = usePathname();
  const isActive =
    item.href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === item.href || pathname.startsWith(item.href + '/');

  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        'relative flex items-center gap-3 h-10 px-4 rounded-lg cursor-pointer transition-colors duration-150',
        isActive
          ? 'text-white bg-white/[0.05]'
          : 'text-white/35 hover:text-white/70 hover:bg-white/[0.03]',
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[var(--accent-blue)]" />
      )}
      <Icon size={18} className="shrink-0" />
      <span className="text-[13px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
        {item.label}
      </span>
    </Link>
  );
}

export function AppSidebar() {
  return (
    <aside className="group flex flex-col h-full w-14 hover:w-48 transition-all duration-200 ease-out bg-[var(--bg-base)] border-r border-white/[0.06] py-4 shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="flex items-center justify-center px-2 mb-6">
        <Link href="/dashboard" className="transition-opacity hover:opacity-80">
          <LogoMark size="md" className="shadow-none" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} />
        ))}
      </nav>

      {/* User — bottom */}
      <div className="mt-auto flex items-center justify-center px-2">
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8',
            },
          }}
        />
      </div>
    </aside>
  );
}
