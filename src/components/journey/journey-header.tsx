import { cn } from '@/lib/utils';

interface JourneyHeaderProps {
  className?: string;
}

export function JourneyHeader({ className }: JourneyHeaderProps) {
  return (
    <header
      className={cn('flex items-center px-6', className)}
      style={{
        height: '56px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div
        className="font-heading font-bold"
        style={{
          fontSize: '15px',
          background: 'linear-gradient(180deg, #ffffff 0%, #93c5fd 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        AI-GOS
      </div>
    </header>
  );
}
