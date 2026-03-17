import { describe, expect, it } from 'vitest';
import * as chartModule from '../tools/chart';

describe('normalizeChartSpec', () => {
  it('maps synthesis-friendly radar data to the AntV radar schema', () => {
    const normalizeChartSpec = (
      chartModule as {
        normalizeChartSpec?: (input: {
          chartType: string;
          title: string;
          data: Array<Record<string, unknown>>;
          xField?: string;
          yField?: string;
          colorField?: string;
          valueField?: string;
        }) => Record<string, unknown>;
      }
    ).normalizeChartSpec;

    expect(normalizeChartSpec).toBeTypeOf('function');

    const spec = normalizeChartSpec!({
      chartType: 'radar',
      title: 'Competitive Positioning',
      data: [
        { competitor: 'Hey Digital', metric: 'Messaging', score: 8 },
        { competitor: 'Hey Digital', metric: 'Pricing', score: 6 },
        { competitor: 'Directive', metric: 'Messaging', score: 7 },
      ],
      xField: 'metric',
      colorField: 'competitor',
      valueField: 'score',
    });

    expect(spec).toEqual({
      title: 'Competitive Positioning',
      data: [
        { name: 'Messaging', value: 8, group: 'Hey Digital' },
        { name: 'Pricing', value: 6, group: 'Hey Digital' },
        { name: 'Messaging', value: 7, group: 'Directive' },
      ],
    });
  });

  it('maps generic pie and bar inputs to category/value records', () => {
    const normalizeChartSpec = (
      chartModule as {
        normalizeChartSpec?: (input: {
          chartType: string;
          title: string;
          data: Array<Record<string, unknown>>;
          xField?: string;
          yField?: string;
          colorField?: string;
          valueField?: string;
        }) => Record<string, unknown>;
      }
    ).normalizeChartSpec;

    expect(normalizeChartSpec).toBeTypeOf('function');

    expect(
      normalizeChartSpec!({
        chartType: 'pie',
        title: 'Recommended Budget Allocation',
        data: [
          { channel: 'LinkedIn', percentage: 55 },
          { channel: 'Google Search', percentage: 45 },
        ],
        colorField: 'channel',
        valueField: 'percentage',
      }),
    ).toEqual({
      title: 'Recommended Budget Allocation',
      data: [
        { category: 'LinkedIn', value: 55 },
        { category: 'Google Search', value: 45 },
      ],
    });

    expect(
      normalizeChartSpec!({
        chartType: 'bar',
        title: 'Channel Priority by ICP Concentration',
        data: [
          { channel: 'LinkedIn', score: 9 },
          { channel: 'Google Search', score: 8 },
        ],
        xField: 'channel',
        yField: 'score',
      }),
    ).toEqual({
      title: 'Channel Priority by ICP Concentration',
      data: [
        { category: 'LinkedIn', value: 9 },
        { category: 'Google Search', value: 8 },
      ],
      group: false,
      stack: false,
    });
  });

  it('does not invent a grouped chart from unrelated string fields', () => {
    const normalizeChartSpec = (
      chartModule as {
        normalizeChartSpec?: (input: {
          chartType: string;
          title: string;
          data: Array<Record<string, unknown>>;
          xField?: string;
          yField?: string;
          colorField?: string;
          valueField?: string;
        }) => Record<string, unknown>;
      }
    ).normalizeChartSpec;

    expect(normalizeChartSpec).toBeTypeOf('function');

    expect(
      normalizeChartSpec!({
        chartType: 'bar',
        title: 'Channel Priority by ICP Concentration',
        data: [
          { label: 'Primary', channel: 'LinkedIn', score: 9 },
          { label: 'Secondary', channel: 'Google Search', score: 8 },
        ],
        xField: 'channel',
        yField: 'score',
      }),
    ).toEqual({
      title: 'Channel Priority by ICP Concentration',
      data: [
        { category: 'LinkedIn', value: 9 },
        { category: 'Google Search', value: 8 },
      ],
      group: false,
      stack: false,
    });
  });

  it('can normalize valid rows even when the first row is sparse', () => {
    const normalizeChartSpec = (
      chartModule as {
        normalizeChartSpec?: (input: {
          chartType: string;
          title: string;
          data: Array<Record<string, unknown>>;
          xField?: string;
          yField?: string;
          colorField?: string;
          valueField?: string;
        }) => Record<string, unknown>;
      }
    ).normalizeChartSpec;

    expect(normalizeChartSpec).toBeTypeOf('function');

    expect(
      normalizeChartSpec!({
        chartType: 'radar',
        title: 'Competitive Positioning',
        data: [
          { note: 'draft row missing chart fields' },
          { competitor: 'Hey Digital', metric: 'Messaging', score: 8 },
          { competitor: 'Directive', metric: 'Messaging', score: 7 },
        ],
        xField: 'metric',
        colorField: 'competitor',
        valueField: 'score',
      }),
    ).toEqual({
      title: 'Competitive Positioning',
      data: [
        { name: 'Messaging', value: 8, group: 'Hey Digital' },
        { name: 'Messaging', value: 7, group: 'Directive' },
      ],
    });
  });
});

// generateChart was removed — charts are now rendered client-side via Recharts
