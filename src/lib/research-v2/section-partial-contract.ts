import { z } from 'zod';

/**
 * The section-partial wire contract, shared by BOTH boundaries:
 *
 *  - Producer (broadcast boundary): `makeSectionPartialPayload` parses through
 *    this schema before the payload leaves the server, so a malformed envelope
 *    is caught at the source rather than only at the client.
 *  - Consumer (subscribe boundary): `useSectionPartials` `.safeParse`s every
 *    inbound broadcast against this same schema.
 *
 * `runId` is intentionally NOT a field — it is the broadcast TOPIC
 * (`section-partials:<runId>`), not part of the payload.
 *
 * This module is `'use client'`-pure (zod only, no React / supabase-client
 * imports) so the server-side broadcaster can import it without dragging a
 * client boundary into the lab-engine bundle.
 */
export const sectionPartialPayloadSchema = z
  .object({
    zone: z.string().min(1),
    sectionId: z.string().min(1),
    seq: z.number().int().nonnegative(),
    snapshot: z.record(z.string(), z.unknown()),
  })
  .strict();

export type SectionPartialPayload = z.infer<typeof sectionPartialPayloadSchema>;

/**
 * Drop a committed zone's stale partial from the by-zone map.
 *
 * Additive to `applySectionPartialPayload`: that reducer never removes a zone,
 * so once a section commits its last partial lingers in the Record forever and
 * is only hidden by the `activeStatus === 'running'` render guard. Clearing on
 * commit makes that guard explicit instead of implicit.
 */
export function clearSectionPartial<T>(
  current: Record<string, T>,
  zone: string,
): Record<string, T> {
  if (current[zone] === undefined) {
    return current;
  }

  const next = { ...current };
  delete next[zone];
  return next;
}
