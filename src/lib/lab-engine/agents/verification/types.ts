export type Claim =
  | { kind: "numeric"; value: string; raw: string }
  | {
      kind: "numericAttribution";
      value: string;
      raw: string;
      assertedSourceUrl?: string;
    }
  | { kind: "quote"; value: string; raw: string }
  | {
      kind: "quoteAttribution";
      value: string;
      raw: string;
      assertedSource: string;
      assertedSourceUrl?: string;
    }
  | { kind: "url"; value: string; raw: string }
  | { kind: "entityName"; value: string; raw: string };

export type VerificationSourceRef =
  | { kind: "toolResult"; toolName: string; stepIndex: number; field?: string }
  | { kind: "corpusExcerpt"; excerptIndex: number; sourceUrl: string }
  | { kind: "userProvided"; field?: string };

export type EntailmentVerdict = "supported" | "refuted" | "user_asserted";

export type ClaimVerdict =
  | {
      status: "verified";
      claim: Claim;
      matchedSourceRef: VerificationSourceRef;
      entailmentVerdict?: Extract<
        EntailmentVerdict,
        "supported" | "user_asserted"
      >;
      entailmentRationale?: string;
    }
  | {
      status: "unsupported";
      claim: Claim;
      reason: "no_match" | "partial_match";
      entailmentVerdict?: Extract<EntailmentVerdict, "refuted">;
      entailmentRationale?: string;
    };

export interface VerificationReport {
  verifiedCount: number;
  unsupportedCount: number;
  claims: ClaimVerdict[];
}
