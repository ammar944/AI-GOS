"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCarousel } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

export function CarouselNavigation({ total }: { total: number }) {
  const { selectedIndex, scrollPrev, scrollNext, canScrollPrev, canScrollNext } = useCarousel();

  return (
    <div className="flex flex-col items-center gap-3 mt-6">
      {/* Centered Navigation Controls */}
      <div className="flex items-center gap-4">
        {/* Previous Button */}
        <button
          onClick={scrollPrev}
          disabled={!canScrollPrev}
          className={cn(
            "h-12 w-12 rounded-full flex items-center justify-center transition-all shadow-sm",
            canScrollPrev
              ? "bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] hover:scale-105 active:scale-95 border border-[var(--border-default)]"
              : "bg-[var(--bg-surface)] text-[var(--text-quaternary)] cursor-not-allowed opacity-50"
          )}
          aria-label="Previous ad"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        {/* Slide Counter - Center */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-full" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <span className="text-base font-semibold tabular-nums min-w-[1.5rem] text-center" style={{ color: 'var(--text-primary)' }}>
            {selectedIndex + 1}
          </span>
          <span className="text-sm" style={{ color: 'var(--text-quaternary)' }}>/</span>
          <span className="text-base font-medium tabular-nums min-w-[1.5rem] text-center" style={{ color: 'var(--text-tertiary)' }}>
            {total}
          </span>
        </div>

        {/* Next Button */}
        <button
          onClick={scrollNext}
          disabled={!canScrollNext}
          className={cn(
            "h-12 w-12 rounded-full flex items-center justify-center transition-all shadow-sm",
            canScrollNext
              ? "bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] hover:scale-105 active:scale-95 border border-[var(--border-default)]"
              : "bg-[var(--bg-surface)] text-[var(--text-quaternary)] cursor-not-allowed opacity-50"
          )}
          aria-label="Next ad"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-48 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-hover)' }}>
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${((selectedIndex + 1) / total) * 100}%`,
            backgroundColor: 'var(--accent-blue)'
          }}
        />
      </div>
    </div>
  );
}
