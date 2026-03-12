declare module '@antv/mcp-server-chart/sdk' {
  export interface ChartToolResultItem {
    type?: string;
    text?: string;
    url?: string;
  }

  export interface ChartToolResult {
    content?: ChartToolResultItem[];
    _meta?: Record<string, unknown>;
  }

  export function callTool(
    tool: string,
    args?: Record<string, unknown>,
  ): Promise<ChartToolResult>;
}
