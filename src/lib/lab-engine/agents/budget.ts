export class ToolBudget {
  private used = 0;

  public constructor(public readonly max: number) {}

  // `toolName` is accepted for interface parity with SectionToolBudget but
  // ignored here: the generic budget treats every tool identically.
  public consume(_toolName?: string): boolean {
    if (this.used >= this.max) {
      return false;
    }

    this.used += 1;
    return true;
  }

  public remaining(): number {
    return Math.max(0, this.max - this.used);
  }

  public isExhausted(): boolean {
    return this.used >= this.max;
  }
}

const AD_TOOL_NAMES: ReadonlySet<string> = new Set([
  "adlibrary",
  "google_ads",
  "meta_ads",
  "linkedin_ads",
]);

// A section budget with two pools: a generic pool every tool can draw from and
// a reserved pool only ad tools (adlibrary/google_ads/meta_ads) may use after
// the generic pool is exhausted. This stops generic web_search/firecrawl/reviews
// calls from starving the deterministic competitor ad probe. With adReservedMax
// at 0 the class behaves identically to a plain ToolBudget(genericMax).
export class SectionToolBudget {
  private genericUsed = 0;
  private adReservedUsed = 0;

  public constructor(
    public readonly genericMax: number,
    public readonly adReservedMax: number = 0,
  ) {}

  // Back-compat: total pool size across generic + reserved.
  public get max(): number {
    return this.genericMax + this.adReservedMax;
  }

  public consume(toolName?: string): boolean {
    const isAdTool = toolName !== undefined && AD_TOOL_NAMES.has(toolName);

    // Ad tools draw from the reserved pool first so generic tools cannot strand
    // the deterministic competitor ad probe; they fall back to the generic pool
    // only when the reserve is exhausted. Non-ad tools only ever use generic.
    if (isAdTool && this.adReservedUsed < this.adReservedMax) {
      this.adReservedUsed += 1;
      return true;
    }

    if (this.genericUsed < this.genericMax) {
      this.genericUsed += 1;
      return true;
    }

    return false;
  }

  public remaining(): number {
    return Math.max(0, this.max - this.genericUsed - this.adReservedUsed);
  }

  public isExhausted(): boolean {
    return this.remaining() === 0;
  }
}
