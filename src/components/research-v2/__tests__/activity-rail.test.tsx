import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ALL_ACTIVITY_PHASES,
  ActivityRail,
  CompletedActivitySummary,
  phaseLabel,
  type ActivityStep,
} from '../activity-rail';
import { ACTIVITY_TONE_CLASS, PHASE_ICON } from '../ui-kit';

afterEach(() => {
  cleanup();
});

const SAMPLE_STEPS: ActivityStep[] = [
  {
    phase: 'preparing',
    label: 'Preparing context',
    status: 'complete',
    tone: 'neutral',
  },
  {
    phase: 'searching',
    label: 'Searching source evidence',
    status: 'complete',
    tone: 'success',
    chips: ['b2b saas pricing'],
  },
  {
    phase: 'drafting',
    label: 'Drafting section',
    status: 'active',
    tone: 'active',
  },
];

describe('phaseLabel', () => {
  it.each(ALL_ACTIVITY_PHASES)('returns a label for %s', (phase) => {
    expect(phaseLabel(phase).length).toBeGreaterThan(0);
  });
});

describe('PHASE_ICON rail coverage', () => {
  it('maps every ActivityPhase to a Lucide icon', () => {
    for (const phase of ALL_ACTIVITY_PHASES) {
      expect(PHASE_ICON[phase]).toBeDefined();
    }
  });
});

describe('ActivityRail', () => {
  it('renders one spinner and shimmer label when live', () => {
    const { container } = render(
      <ActivityRail
        steps={SAMPLE_STEPS}
        currentLabel="Researching live sources…"
        live
      />,
    );

    expect(container.querySelectorAll('.animate-spin')).toHaveLength(1);
    expect(screen.getByText('Researching live sources…')).toBeInTheDocument();
    expect(screen.getByText('Drafting section')).toBeInTheDocument();
  });

  it('renders no spinner when not live', () => {
    const { container } = render(
      <ActivityRail
        steps={SAMPLE_STEPS}
        currentLabel="Researching live sources…"
        live={false}
      />,
    );

    expect(container.querySelectorAll('.animate-spin')).toHaveLength(0);
  });

  it('does not render emoji in step text', () => {
    const { container } = render(
      <ActivityRail steps={SAMPLE_STEPS} currentLabel="Working…" live />,
    );

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/🔍|🧠|💭|📄|⏱|✗/);
  });

  it('uses distinct active and success tone classes', () => {
    expect(ACTIVITY_TONE_CLASS.active).not.toBe(ACTIVITY_TONE_CLASS.success);
    expect(ACTIVITY_TONE_CLASS.active).toContain('text-primary');
    expect(ACTIVITY_TONE_CLASS.success).toContain('text-emerald-600');
  });
});

describe('CompletedActivitySummary', () => {
  it('shows a collapsed researched summary line', () => {
    render(
      <CompletedActivitySummary
        sourceCount={14}
        toolCount={6}
        durationLabel="1:38"
      />,
    );

    expect(
      screen.getByText('Researched 14 sources · 6 tools · 1:38'),
    ).toBeInTheDocument();
  });

  it('expands on trigger click', () => {
    render(
      <CompletedActivitySummary sourceCount={3} toolCount={2} durationLabel="42s" />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Researched 3 sources · 2 tools · 42s/i }),
    );

    expect(
      screen.getByText(/Activity trace is collapsed after commit/i),
    ).toBeInTheDocument();
  });
});
