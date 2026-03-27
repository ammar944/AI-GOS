'use client';

interface CardGridProps {
  children: React.ReactNode;
}

export function CardGrid({ children }: CardGridProps) {
  return (
    <div className="space-y-3 pb-6">
      {children}
    </div>
  );
}
