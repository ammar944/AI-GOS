'use client';

import { useState } from 'react';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';
import { RightRail } from './right-rail';

export function BottomSheet() {
  const [open, setOpen] = useState(false);
  const { state } = useWorkspace();
  const meta = SECTION_META[state.currentSection] ?? DEFAULT_SECTION_META;

  return (
    <Drawer open={open} onOpenChange={setOpen} snapPoints={[0.4, 0.85]} direction="bottom">
      <DrawerTrigger asChild>
        <button
          type="button"
          className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-chat)] px-4 py-3 md:hidden"
        >
          <div className="h-1 w-8 rounded-full bg-[var(--text-quaternary)]" />
          <span className="font-mono text-xs text-[var(--text-tertiary)]">
            Chat &middot; {meta.label}
          </span>
        </button>
      </DrawerTrigger>
      <DrawerContent className="bg-[var(--bg-chat)] md:hidden">
        <div className="h-[85vh] overflow-hidden">
          <RightRail className="w-full border-l-0 h-full" />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
