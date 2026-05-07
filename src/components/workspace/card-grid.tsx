'use client';

import { cn } from '@/lib/utils';

interface CardGridProps {
  children: React.ReactNode;
  variant?: 'cards' | 'report';
}

export function CardGrid({ children, variant = 'cards' }: CardGridProps) {
  return (
    <div
      className={cn(
        variant === 'report'
          ? 'divide-y divide-white/[0.055] pb-10'
          : 'space-y-4 pb-8',
      )}
    >
      {children}
    </div>
  );
}
