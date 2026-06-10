// Voice of Customer shared evidence floors — the ONE source of truth read by
// the candidate prepass (agents/voice-of-customer-candidates.ts), the
// deterministic synthesis (agents/voice-of-customer-synthesis.ts), and the
// schema validator (artifacts/schemas/voice-of-customer.ts).
//
// INVARIANT: the prepass-admit floor MUST equal the commit floor for every
// dimension the prepass gates. Before this module, the prepass admitted packs
// at >=6 candidates while synthesis and the schema rejected below 10 pain
// quotes — so a run with 6-9 REAL quotes passed the prepass and then committed
// an EMPTY section (live run f06333b6). Keep these floors in lockstep.
//
// This file is a pure-constant leaf: artifacts/schemas/ must never import from
// agents/, so the floors live under artifacts/ where both sides can reach them.

/** Minimum pain-language quotes (and prepass candidates) to commit VoC. */
export const VOC_MIN_QUOTES = 6;

/** Minimum independent registrable domains across pain quotes/candidates. */
export const VOC_MIN_DOMAINS = 3;

/** Minimum after-state success quotes promoted by synthesis and the schema. */
export const VOC_MIN_SUCCESS_QUOTES = 3;

/**
 * Minimum distinct top-level source URLs. A floor-sized pack (6 candidates,
 * 3 domains, per-domain URL reuse via sourceInstanceIds) can yield as few as
 * 3 distinct URLs, so this floor matches VOC_MIN_DOMAINS.
 */
export const VOC_MIN_TOP_LEVEL_SOURCES = 3;
