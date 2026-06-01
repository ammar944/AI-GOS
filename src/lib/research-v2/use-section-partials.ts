'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/client';

export const sectionPartialPayloadSchema = z
  .object({
    zone: z.string().min(1),
    sectionId: z.string().min(1),
    seq: z.number().int().nonnegative(),
    snapshot: z.record(z.string(), z.unknown()),
  })
  .strict();

export type SectionPartialState = z.infer<typeof sectionPartialPayloadSchema>;
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

export function useSectionPartials(runId: string): SectionPartialsByZone {
  const [partials, setPartials] = useState<SectionPartialsByZone>({});

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
