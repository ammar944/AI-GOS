"use client";

import { Loader2 } from "lucide-react";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";

export function GenerateLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'rgb(7, 9, 14)' }}>
      <ShaderMeshBackground variant="hero" />
      <BackgroundPattern opacity={0.02} />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'rgb(54, 94, 255)' }} />
        <p
          className="text-sm"
          style={{
            color: 'rgb(205, 208, 213)',
            fontFamily: 'var(--font-sans), Inter, sans-serif',
          }}
        >
          Loading your business profile...
        </p>
      </div>
    </div>
  );
}
