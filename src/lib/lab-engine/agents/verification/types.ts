export type Claim =
  | { kind: "numeric"; value: string; raw: string }
  | { kind: "quote"; value: string; raw: string }
  | { kind: "url"; value: string; raw: string }
  | { kind: "entityName"; value: string; raw: string };

export type VerificationSourceRef =
  | { kind: "toolResult"; toolName: string; stepIndex: number; field?: string }
  | { kind: "corpusExcerpt"; excerptIndex: number; sourceUrl: string };

export type ClaimVerdict =
  | {
      status: "verified";
      claim: Claim;
      matchedSourceRef: VerificationSourceRef;
    }
  | {
      status: "unsupported";
      claim: Claim;
      reason: "no_match" | "partial_match";
    };

export interface VerificationReport {
  verifiedCount: number;
  unsupportedCount: number;
  claims: ClaimVerdict[];
}
