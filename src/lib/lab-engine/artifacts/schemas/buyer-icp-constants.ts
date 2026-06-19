// Leaf module — no imports. Guarantees BUYER_PERSONA_GROUNDING_FIELD is
// initialized before any consumer (including source-liveness.ts which reads
// it at module top-level), breaking the buyer-icp ↔ source-liveness cycle.
export const BUYER_PERSONA_GROUNDING_FIELD = "segmentLabel" as const;
