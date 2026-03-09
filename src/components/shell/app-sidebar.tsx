'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Shield,
  Download,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavIconType = React.ComponentType<{ width?: number; height?: number; strokeWidth?: number }>;

interface NavEntry {
  icon: NavIconType;
  label: string;
  href: string;
}

// Custom SVG icons matching the mockup exactly

function JourneyIcon({ width = 18, height = 18, strokeWidth = 2, ...props }: React.SVGProps<SVGSVGElement> & { width?: number; height?: number; strokeWidth?: number }) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} viewBox="0 0 24 24" width={width} height={height} {...props}>
      <path d="M12 2v20" />
      <path d="m4.93 4.93 14.14 14.14" />
      <path d="M2 12h20" />
      <path d="m19.07 4.93-14.14 14.14" />
    </svg>
  );
}

function BlueprintsIcon({ width = 18, height = 18, strokeWidth = 2, ...props }: React.SVGProps<SVGSVGElement> & { width?: number; height?: number; strokeWidth?: number }) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} viewBox="0 0 24 24" width={width} height={height} {...props}>
      <rect height="18" rx="2" width="18" x="3" y="3" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

const NAV_ITEMS: NavEntry[] = [
  { icon: Home,           label: 'Home',        href: '/' },
  { icon: JourneyIcon,    label: 'Journey',     href: '/journey' },
  { icon: BlueprintsIcon, label: 'Blueprints',  href: '/blueprints' },
  { icon: Shield,         label: 'Ad Launcher', href: '/ads' },
  { icon: Download,       label: 'Creatives',   href: '/creatives' },
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
