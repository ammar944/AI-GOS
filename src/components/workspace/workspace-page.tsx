'use client';

import { StatusStrip } from './status-strip';
import { ArtifactCanvas } from './artifact-canvas';
import { RightRail } from './right-rail';

export function WorkspacePage() {
  return (
    <div className="flex h-screen flex-col bg-[var(--bg-base)]">
      <StatusStrip />
      <div className="flex flex-1 overflow-hidden">
        <ArtifactCanvas />
        {/* Right rail hidden on mobile, shown on md+ */}
        <div className="hidden md:flex">
          <RightRail />
        </div>
      </div>
    </div>
  );
}
