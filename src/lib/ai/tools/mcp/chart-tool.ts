// MCP Tool Wrapper: AntV Chart Generator
// betaZodTool wrapping @antv/mcp-server-chart/sdk for use by Anthropic SDK sub-agents

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { callTool } from '@antv/mcp-server-chart/sdk';

const CHART_TYPES = [
  'bar',
  'pie',
  'radar',
  'funnel',
  'word_cloud',
  'dual_axes',
  'line',
  'sankey',
] as const;

export const chartTool = betaZodTool({
  name: 'generateChart',
  description:
    'Generate a data visualization chart and get back a hosted image URL. ' +
    'Use for: pie (budget allocation), radar (competitor scoring), bar (comparisons), ' +
    'funnel (conversion path), word_cloud (keyword themes). ' +
    'Returns a URL to a hosted PNG image you can embed in your response.',
  inputSchema: z.object({
    chartType: z
      .enum(CHART_TYPES)
      .describe('The type of chart to generate'),
    title: z.string().describe('Chart title shown at the top'),
    data: z
      .array(z.record(z.string(), z.unknown()))
      .describe('Array of data objects. Structure depends on chartType.'),
    xField: z
      .string()
      .optional()
      .describe('For bar/line/dual_axes: the field name for the x-axis'),
    yField: z
      .string()
      .optional()
      .describe('For bar/line: the field name for the y-axis'),
    colorField: z
      .string()
      .optional()
      .describe('For pie/radar: the field used for color/category'),
    valueField: z
      .string()
      .optional()
      .describe('For pie/radar/word_cloud: the field with the numeric value'),
  }),
  run: async ({ chartType, title, data, xField, yField, colorField, valueField }) => {
    try {
      const toolName = `generate_${chartType}_chart`;
      const spec: Record<string, unknown> = { title, data };
      if (xField) spec.xField = xField;
      if (yField) spec.yField = yField;
      if (colorField) spec.colorField = colorField;
      if (valueField) spec.valueField = valueField;

      const result = await callTool(toolName, spec);
      // callTool returns MCP SDK format: { content: [...], isError? }
      // Extract URL from content items (image or text with URL)
      let url: string | undefined;
      if (result && typeof result === 'object' && 'content' in result && Array.isArray(result.content)) {
        for (const item of result.content as Array<Record<string, unknown>>) {
          if (item.type === 'image' && typeof item.url === 'string') {
            url = item.url;
            break;
          }
          if (item.type === 'text' && typeof item.text === 'string') {
            // May contain a URL in the text
            const match = item.text.match(/https?:\/\/\S+/);
            if (match) { url = match[0]; break; }
          }
        }
      }
      return JSON.stringify({
        success: true,
        url: url ?? null,
        raw: result,
        chartType,
        title,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
