'use client';

import { cn } from '@/lib/utils';

/**
 * Mesh Glow Background — soft radial gradients creating atmospheric depth.
 * Inspired by Raycast, Jace.ai, Resend landing pages.
 * Pure CSS, zero JS overhead, respects prefers-reduced-motion.
 */
export function AuroraStreaks({ className }: { className?: string }) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      {/* Primary blue glow — top center, hero focus */}
      <div
        className="absolute w-[900px] h-[600px] top-[-15%] left-1/2 -translate-x-1/2 rounded-full aurora-glow"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(54,94,255,0.18) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* Cyan accent glow — upper right */}
      <div
        className="absolute w-[500px] h-[400px] top-[5%] right-[5%] rounded-full aurora-glow-delayed"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(80,248,228,0.10) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Purple accent glow — left side */}
      <div
        className="absolute w-[400px] h-[350px] top-[25%] left-[5%] rounded-full aurora-glow-slow"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(167,139,250,0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Warm blue glow — bottom center, grounds the composition */}
      <div
        className="absolute w-[700px] h-[400px] bottom-[5%] left-1/2 -translate-x-1/2 rounded-full aurora-glow-delayed"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(54,94,255,0.06) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* Subtle noise/grain overlay for texture */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
