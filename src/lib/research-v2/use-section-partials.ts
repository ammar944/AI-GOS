'use client';

import { useEffect, useState } from 'react';

import {
  clearSectionPartial,
  sectionPartialPayloadSchema,
  type SectionPartialPayload,
} from '@/lib/research-v2/section-partial-contract';
import { createClient } from '@/lib/supabase/client';

// Re-exported so existing consumers (and tests) keep importing the schema and
// state type from this module; the contract itself now lives in the neutral
// `section-partial-contract` module enforced at both the broadcast and
// subscribe boundaries.
export { sectionPartialPayloadSchema };
export type SectionPartialState = SectionPartialPayload;
export type SectionPartialsByZone = Record<string, SectionPartialState>;

export function applySectionPartialPayload(
  current: SectionPartialsByZone,
  payload: SectionPartialState,
): SectionPartialsByZone {
  const existing = current[payload.zone];

  if (existing !== undefined && existing.seq >= payload.seq) {
    return current;
  }

  return {
    ...current,
    [payload.zone]: payload,
  };
}

export function useSectionPartials(
  runId: string,
  committedZones?: ReadonlySet<string>,
): SectionPartialsByZone {
  const [partials, setPartials] = useState<SectionPartialsByZone>({});

  // Explicit on-commit clear: once a zone reaches a terminal status its draft
  // partial is no longer rendered (the `activeStatus === 'running'` render
  // guard hides it), so drop it from the Record instead of letting it linger.
  // Layered UNDER that render guard — this is the explicit form of what the
  // guard implied. Does not touch the stale-seq reducer.
  useEffect(() => {
    if (committedZones === undefined || committedZones.size === 0) {
      return;
    }

    setPartials((current) => {
      let next = current;
      for (const zone of committedZones) {
        next = clearSectionPartial(next, zone);
      }
      return next;
    });
  }, [committedZones]);

  useEffect(() => {
    if (runId.trim().length === 0) {
      setPartials({});
      return undefined;
    }

    setPartials({});

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (
      supabaseUrl === undefined ||
      supabaseUrl.length === 0 ||
      supabaseAnonKey === undefined ||
      supabaseAnonKey.length === 0
    ) {
      return undefined;
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`section-partials:${runId}`)
      .on('broadcast', { event: 'partial' }, (message) => {
        const parsed = sectionPartialPayloadSchema.safeParse(message.payload);

        if (!parsed.success) {
          console.warn('[use-section-partials] malformed partial payload', {
            runId,
            issues: parsed.error.issues,
          });
          return;
        }

        setPartials((current) =>
          applySectionPartialPayload(current, parsed.data),
        );
      })
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [runId]);

  return partials;
}
