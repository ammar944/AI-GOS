'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Compass,
  FileText,
  Rocket,
  Palette,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface NavEntry {
  icon: LucideIcon;
  label: string;
  href: string;
}

const NAV_ITEMS: NavEntry[] = [
  { icon: Home,    label: 'Home',        href: '/' },
  { icon: Compass, label: 'Journey',     href: '/journey' },
  { icon: FileText,label: 'Blueprints',  href: '/blueprints' },
  { icon: Rocket,  label: 'Ad Launcher', href: '/ads' },
  { icon: Palette, label: 'Creatives',   href: '/creatives' },
];

const SETTINGS_ITEM: NavEntry = { icon: Settings, label: 'Settings', href: '/settings' };

function SidebarLink({ item }: { item: NavEntry }) {
  const pathname = usePathname();
  const isActive =
    item.href === '/'
      ? pathname === '/'
      : pathname === item.href || pathname.startsWith(item.href + '/');

  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 text-sm rounded-control transition-all',
        isActive
          ? 'text-brand-accent bg-white/5 font-medium'
          : 'text-white/50 hover:text-white hover:bg-white/5',
      )}
    >
      <Icon width={18} height={18} strokeWidth={2} />
      {item.label}
    </Link>
  );
}

export function AppSidebar() {
  return (
    <aside className="w-64 flex-none border-r border-brand-border flex flex-col p-6 space-y-8">
      {/* Navigation */}
      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Settings at bottom, separated */}
      <div className="mt-auto border-t border-brand-border pt-6">
        <SidebarLink item={SETTINGS_ITEM} />
      </div>
    </aside>
  );
}
