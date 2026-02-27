import { cn } from '@/lib/utils';

interface JourneyHeaderProps {
  className?: string;
  completionPercentage?: number;
}

export function JourneyHeader({ className, completionPercentage = 0 }: JourneyHeaderProps) {
  const clamped = Math.min(100, Math.max(0, completionPercentage));

  return (
    <div className={cn(className)}>
      <header
        className="flex items-center px-6"
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
      <div
        style={{
          height: '2px',
          width: '100%',
          backgroundColor: 'var(--border-subtle, rgba(255, 255, 255, 0.06))',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${clamped}%`,
            backgroundColor: 'var(--accent-blue, rgb(54, 94, 255))',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}
