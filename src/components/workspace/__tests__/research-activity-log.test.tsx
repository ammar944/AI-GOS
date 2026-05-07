import { render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ResearchJobActivity } from '@/lib/journey/research-job-activity';
import { ResearchActivityLog } from '../research-activity-log';

interface MotionStubProps {
  children?: ReactNode;
  [key: string]: unknown;
}

function renderMotionElement(element: string, props: MotionStubProps): ReactNode {
  const domProps = Object.fromEntries(
    Object.entries(props).filter(([key]) =>
      ![
        'animate',
        'children',
        'exit',
        'initial',
        'layout',
        'transition',
        'variants',
        'whileHover',
        'whileTap',
      ].includes(key),
    ),
  );

  return createElement(element, domProps, props.children);
}

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: MotionStubProps) => renderMotionElement('div', props),
    img: (props: MotionStubProps) => renderMotionElement('img', props),
    p: (props: MotionStubProps) => renderMotionElement('p', props),
    span: (props: MotionStubProps) => renderMotionElement('span', props),
    svg: (props: MotionStubProps) => renderMotionElement('svg', props),
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function makeActivity(updates: ResearchJobActivity['updates']): ResearchJobActivity {
  return {
    jobId: 'job-market',
    section: 'industryMarket',
    status: 'running',
    tool: 'researchIndustryMarket',
    startedAt: '2026-05-07T00:00:00.000Z',
    lastHeartbeat: '2026-05-07T00:00:05.000Z',
    updates,
  };
}

describe('ResearchActivityLog', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('renders honest waiting copy instead of fake activity when no worker updates exist', () => {
    render(
      <ResearchActivityLog
        section="industryMarket"
        sectionLabel="Market Overview"
        phase="researching"
        activity={makeActivity([])}
      />,
    );

    expect(screen.getByText('Awaiting worker telemetry')).toBeInTheDocument();
    expect(screen.getByText(/Waiting for worker telemetry and source trace/u)).toBeInTheDocument();
    expect(screen.queryByText('Searching market intelligence databases')).not.toBeInTheDocument();
    expect(screen.queryByText('Initializing research pipeline')).not.toBeInTheDocument();
  });

  it('renders actual worker messages when real updates exist', () => {
    render(
      <ResearchActivityLog
        section="industryMarket"
        sectionLabel="Market Overview"
        phase="researching"
        activity={makeActivity([
          {
            id: 'update-1',
            at: '2026-05-07T00:00:01.000Z',
            phase: 'runner',
            message: 'Worker accepted market overview job.',
          },
          {
            id: 'update-2',
            at: '2026-05-07T00:00:02.000Z',
            phase: 'tool',
            message: 'Reading verified source trace from worker telemetry.',
          },
        ])}
      />,
    );

    expect(screen.getByText('Worker accepted market overview job.')).toBeInTheDocument();
    expect(screen.getByText('Reading verified source trace from worker telemetry.')).toBeInTheDocument();
    expect(screen.queryByText(/Waiting for worker telemetry and source trace/u)).not.toBeInTheDocument();
    expect(screen.queryByText('Searching market intelligence databases')).not.toBeInTheDocument();
  });
});
