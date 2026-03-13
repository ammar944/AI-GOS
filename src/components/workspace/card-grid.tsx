'use client';

interface CardGridProps {
  children: React.ReactNode;
}

export function CardGrid({ children }: CardGridProps) {
  return (
    <div className="space-y-4 pb-8">
      {children}
    </div>
  );
}
