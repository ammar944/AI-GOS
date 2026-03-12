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
type ChartType = (typeof CHART_TYPES)[number];
type ChartDatum = Record<string, unknown>;

interface ChartToolInput {
  chartType: ChartType;
  title: string;
  data: ChartDatum[];
  xField?: string;
  yField?: string;
  colorField?: string;
  valueField?: string;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.replaceAll(',', ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim().length > 0)))];
}

function getFirstRecord(data: ChartDatum[]): ChartDatum | null {
  return data.find((entry) => entry && typeof entry === 'object') ?? null;
}

function getRecordKeys(data: ChartDatum[]): string[] {
  return [...new Set(data.flatMap((entry) => Object.keys(entry)))];
}

function pickStringField(
  data: ChartDatum[],
  candidates: string[],
  options: { allowFallback?: boolean } = {},
): string | null {
  if (!getFirstRecord(data)) {
    return null;
  }

  for (const candidate of candidates) {
    if (data.some((entry) => asString(entry[candidate]) !== null)) {
      return candidate;
    }
  }

  if (options.allowFallback === false) {
    return null;
  }

  for (const key of getRecordKeys(data)) {
    if (data.some((entry) => asString(entry[key]) !== null)) {
      return key;
    }
  }

  return null;
}

function pickNumberField(
  data: ChartDatum[],
  candidates: string[],
  options: { allowFallback?: boolean } = {},
): string | null {
  if (!getFirstRecord(data)) {
    return null;
  }

  for (const candidate of candidates) {
    if (data.some((entry) => asNumber(entry[candidate]) !== null)) {
      return candidate;
    }
  }

  if (options.allowFallback === false) {
    return null;
  }

  for (const key of getRecordKeys(data)) {
    if (data.some((entry) => asNumber(entry[key]) !== null)) {
      return key;
    }
  }

  return null;
}

function normalizeSimpleSeries(
  data: ChartDatum[],
  categoryField: string,
  valueField: string,
  groupField?: string,
): Array<{ category: string; value: number; group?: string }> {
  return data
    .map((entry) => {
      const category = asString(entry[categoryField]);
      const value = asNumber(entry[valueField]);
      const group = groupField ? asString(entry[groupField]) : null;

      if (!category || value === null) {
        return null;
      }

      if (!groupField || !group) {
        return { category, value };
      }

      return { category, value, group };
    })
    .filter((entry): entry is { category: string; value: number; group?: string } => entry !== null);
}

function normalizeRadarSeries(
  data: ChartDatum[],
  nameField: string,
  valueField: string,
  groupField?: string,
): Array<{ name: string; value: number; group?: string }> {
  return data
    .map((entry) => {
      const name = asString(entry[nameField]);
      const value = asNumber(entry[valueField]);
      const group = groupField ? asString(entry[groupField]) : null;

      if (!name || value === null) {
        return null;
      }

      if (!groupField || !group) {
        return { name, value };
      }

      return { name, value, group };
    })
    .filter((entry): entry is { name: string; value: number; group?: string } => entry !== null);
}

function buildGenericSpec(input: ChartToolInput): Record<string, unknown> {
  const spec: Record<string, unknown> = {
    title: input.title,
    data: input.data,
  };

  if (input.xField) spec.xField = input.xField;
  if (input.yField) spec.yField = input.yField;
  if (input.colorField) spec.colorField = input.colorField;
  if (input.valueField) spec.valueField = input.valueField;

  return spec;
}

function normalizeChartSpec(input: ChartToolInput): Record<string, unknown> {
  if (input.chartType === 'pie') {
    const categoryField = pickStringField(
      input.data,
      unique([input.colorField, input.xField, 'category', 'channel', 'platform', 'name', 'label']),
    );
    const numericField = pickNumberField(
      input.data,
      unique([input.valueField, input.yField, 'value', 'percentage', 'score', 'amount']),
    );

    if (!categoryField || !numericField) {
      throw new Error('Unable to normalize pie chart data for AntV MCP');
    }

    return {
      title: input.title,
      data: normalizeSimpleSeries(input.data, categoryField, numericField).map((entry) => ({
        category: entry.category,
        value: entry.value,
      })),
    };
  }

  if (input.chartType === 'bar') {
    const categoryField = pickStringField(
      input.data,
      unique([input.xField, 'category', 'channel', 'platform', 'name', 'label']),
    );
    const numericField = pickNumberField(
      input.data,
      unique([input.yField, input.valueField, 'value', 'score', 'amount', 'percentage']),
    );
    const groupField = pickStringField(
      input.data,
      unique([
        input.colorField && input.colorField !== categoryField ? input.colorField : undefined,
        'group',
      ]),
      { allowFallback: false },
    );

    if (!categoryField || !numericField) {
      throw new Error('Unable to normalize bar chart data for AntV MCP');
    }

    const normalizedData = normalizeSimpleSeries(
      input.data,
      categoryField,
      numericField,
      groupField && groupField !== categoryField ? groupField : undefined,
    );

    return {
      title: input.title,
      data: normalizedData,
      group: Boolean(groupField && groupField !== categoryField),
      stack: false,
    };
  }

  if (input.chartType === 'radar') {
    const nameField = pickStringField(
      input.data,
      unique([input.xField, 'name', 'metric', 'dimension', 'category', 'label']),
    );
    const numericField = pickNumberField(
      input.data,
      unique([input.valueField, input.yField, 'value', 'score', 'amount', 'percentage']),
    );
    const groupField = pickStringField(
      input.data,
      unique([
        input.colorField && input.colorField !== nameField ? input.colorField : undefined,
        'group',
        'competitor',
        'series',
      ]),
      { allowFallback: false },
    );

    if (!nameField || !numericField) {
      throw new Error('Unable to normalize radar chart data for AntV MCP');
    }

    return {
      title: input.title,
      data: normalizeRadarSeries(
        input.data,
        nameField,
        numericField,
        groupField && groupField !== nameField ? groupField : undefined,
      ),
    };
  }

  return buildGenericSpec(input);
}

function extractChartImageUrl(result: unknown): string | null {
  if (!result || typeof result !== 'object' || !('content' in result) || !Array.isArray(result.content)) {
    return null;
  }

  for (const item of result.content as Array<Record<string, unknown>>) {
    if (item.type === 'image' && typeof item.url === 'string') {
      return item.url;
    }

    if (item.type === 'text' && typeof item.text === 'string') {
      const match = item.text.match(/https?:\/\/\S+/);
      if (match) {
        return match[0];
      }
    }
  }

  return null;
}

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
      const spec = normalizeChartSpec({
        chartType,
        title,
        data,
        xField,
        yField,
        colorField,
        valueField,
      });

      const result = await callTool(toolName, spec);
      const imageUrl = extractChartImageUrl(result);
      return JSON.stringify({
        success: true,
        imageUrl,
        url: imageUrl,
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
