import { cn } from '@/lib/utils';

interface JourneyHeaderProps {
  className?: string;
  completionPercentage?: number;
  onNewJourney?: () => void;
}

export function JourneyHeader({
  className,
  completionPercentage = 0,
  onNewJourney,
}: JourneyHeaderProps) {
  const clamped = Math.min(100, Math.max(0, completionPercentage));

  return (
    <header className={cn('relative flex-none h-16 flex items-center justify-between px-8', className)}
      style={{
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        background: '#050505',
      }}
    >
      {/* Top progress bar — gradient blue→green */}
      <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <div
          className="h-full transition-all duration-1000 ease-in-out"
          style={{
            width: `${clamped}%`,
            background: 'linear-gradient(90deg, #3c83f6 0%, #10B981 100%)',
          }}
        />
      </div>

      {/* Logo */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #3c83f6, #10B981)' }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l1.88 5.76a2 2 0 001.27 1.27L21 12l-5.85 1.97a2 2 0 00-1.27 1.27L12 21l-1.88-5.76a2 2 0 00-1.27-1.27L3 12l5.85-1.97a2 2 0 001.27-1.27L12 3z" />
          </svg>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold text-white tracking-tight">AI-GOS</span>
          <span className="text-xs text-white/40 font-light">V2.0</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-6">
        <button className="text-xs text-white/50 hover:text-white transition-colors">
          Documentation
        </button>
        {onNewJourney && (
          <button
            onClick={onNewJourney}
            className="px-4 py-2 rounded-xl text-xs font-medium text-white transition-colors"
            style={{ background: '#3c83f6' }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#2563eb'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#3c83f6'; }}
          >
            New Journey
          </button>
        )}
      </div>
    </header>
  );
}
