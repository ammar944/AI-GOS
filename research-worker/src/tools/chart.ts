import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { callTool } from '@antv/mcp-server-chart/sdk';
import { z } from 'zod';

const CHART_TYPES = ['bar', 'pie', 'radar', 'funnel', 'word_cloud', 'dual_axes', 'line', 'sankey'] as const;

export const chartTool = betaZodTool({
  name: 'generateChart',
  description: 'Generate a data visualization chart and return a hosted image URL.',
  inputSchema: z.object({
    chartType: z.enum(CHART_TYPES),
    title: z.string(),
    data: z.array(z.record(z.string(), z.unknown())),
    xField: z.string().optional(),
    yField: z.string().optional(),
    colorField: z.string().optional(),
    valueField: z.string().optional(),
  }),
  run: async ({ chartType, title, data, xField, yField, colorField, valueField }) => {
    try {
      const spec: Record<string, unknown> = { title, data };
      if (xField) spec.xField = xField;
      if (yField) spec.yField = yField;
      if (colorField) spec.colorField = colorField;
      if (valueField) spec.valueField = valueField;
      const result = await callTool(`generate_${chartType}_chart`, spec);
      let url: string | undefined;
      if (result && typeof result === 'object' && 'content' in result && Array.isArray(result.content)) {
        for (const item of (result.content as Array<Record<string, unknown>>)) {
          if (item.type === 'image' && typeof item.url === 'string') { url = item.url; break; }
          if (item.type === 'text' && typeof item.text === 'string') {
            const match = (item.text as string).match(/https?:\/\/\S+/);
            if (match) { url = match[0]; break; }
          }
        }
      }
      return JSON.stringify({ success: true, url: url ?? null, chartType, title });
    } catch (error) {
      return JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  },
});
