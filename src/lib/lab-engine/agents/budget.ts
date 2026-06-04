export class ToolBudget {
  private used = 0;

  public constructor(public readonly max: number) {}

  public consumeWithReceipt(): ToolBudgetReceipt | null {
    if (this.used >= this.max) {
      return null;
    }

    this.used += 1;
    return this.createReceipt();
  }

  // `toolName` is accepted for interface parity with SectionToolBudget but
  // ignored here: the generic budget treats every tool identically.
  public consume(toolName?: string): boolean {
    void toolName;
    return this.consumeWithReceipt() !== null;
  }

  public remaining(): number {
    return Math.max(0, this.max - this.used);
  }

  public isExhausted(): boolean {
    return this.used >= this.max;
  }

  private createReceipt(): ToolBudgetReceipt {
    let refunded = false;

    return {
      pool: "generic",
      refund: (): void => {
        if (refunded) {
          return;
        }

        refunded = true;
        this.used = Math.max(0, this.used - 1);
      },
    };
  }
}

const AD_TOOL_NAMES: ReadonlySet<string> = new Set([
  "adlibrary",
  "google_ads",
  "meta_ads",
  "linkedin_ads",
]);

const SCRAPE_RESERVED_TOOL_NAMES: ReadonlySet<string> = new Set([
  "firecrawl",
  "reviews",
]);

export type ToolBudgetPool = "generic" | "ad_reserved" | "scrape_reserved";

export interface ToolBudgetReceipt {
  readonly pool: ToolBudgetPool;
  refund: () => void;
}

// A section budget with a generic pool plus optional reserved pools. Ad tools
// and VoC acquisition tools draw from their reserves first so generic searches
// cannot starve deterministic ad probes or review/scrape recovery.
export class SectionToolBudget {
  private genericUsed = 0;
  private adReservedUsed = 0;
  private scrapeReservedUsed = 0;

  public constructor(
    public readonly genericMax: number,
    public readonly adReservedMax: number = 0,
    public readonly scrapeReservedMax: number = 0,
  ) {}

  // Back-compat: total pool size across generic + reserved.
  public get max(): number {
    return this.genericMax + this.adReservedMax + this.scrapeReservedMax;
  }

  public consumeWithReceipt(toolName?: string): ToolBudgetReceipt | null {
    const isAdTool = toolName !== undefined && AD_TOOL_NAMES.has(toolName);
    const isScrapeReservedTool =
      toolName !== undefined && SCRAPE_RESERVED_TOOL_NAMES.has(toolName);

    // Ad tools draw from the reserved pool first so generic tools cannot strand
    // the deterministic competitor ad probe; they fall back to the generic pool
    // only when the reserve is exhausted. Non-ad tools only ever use generic.
    if (isAdTool && this.adReservedUsed < this.adReservedMax) {
      this.adReservedUsed += 1;
      return this.createReceipt("ad_reserved");
    }

    if (
      isScrapeReservedTool &&
      this.scrapeReservedUsed < this.scrapeReservedMax
    ) {
      this.scrapeReservedUsed += 1;
      return this.createReceipt("scrape_reserved");
    }

    if (this.genericUsed < this.genericMax) {
      this.genericUsed += 1;
      return this.createReceipt("generic");
    }

    return null;
  }

  public consume(toolName?: string): boolean {
    return this.consumeWithReceipt(toolName) !== null;
  }

  public remaining(): number {
    return Math.max(
      0,
      this.max -
        this.genericUsed -
        this.adReservedUsed -
        this.scrapeReservedUsed,
    );
  }

  public isExhausted(): boolean {
    return this.remaining() === 0;
  }

  private createReceipt(pool: ToolBudgetPool): ToolBudgetReceipt {
    let refunded = false;

    return {
      pool,
      refund: (): void => {
        if (refunded) {
          return;
        }

        refunded = true;

        if (pool === "ad_reserved") {
          this.adReservedUsed = Math.max(0, this.adReservedUsed - 1);
          return;
        }

        if (pool === "scrape_reserved") {
          this.scrapeReservedUsed = Math.max(0, this.scrapeReservedUsed - 1);
          return;
        }

        this.genericUsed = Math.max(0, this.genericUsed - 1);
      },
    };
  }
}
