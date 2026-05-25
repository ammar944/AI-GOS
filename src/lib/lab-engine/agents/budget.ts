export class ToolBudget {
  private used = 0;

  public constructor(public readonly max: number) {}

  public consume(): boolean {
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
