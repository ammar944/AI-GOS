import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  PrefillStreamView,
  type PrefillStreamViewProps,
} from '@/components/journey/prefill-stream-view';

vi.mock('framer-motion', () => ({
  motion: {
    div: (
      props: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>,
    ) => {
      const sanitizedProps = { ...props };
      delete sanitizedProps.children;
      delete sanitizedProps.initial;
      delete sanitizedProps.animate;
      delete sanitizedProps.exit;
      delete sanitizedProps.transition;
      delete sanitizedProps.variants;
      delete sanitizedProps.whileHover;
      delete sanitizedProps.whileTap;

      return <div {...sanitizedProps}>{props.children}</div>;
    },
  },
}));

function createProps(
  overrides: Partial<PrefillStreamViewProps> = {},
): PrefillStreamViewProps {
  return {
    partialResult: undefined,
    fieldsFound: 0,
    isPrefilling: false,
    error: undefined,
    websiteUrl: 'https://saaslaunch.net',
    onRetry: vi.fn(),
    onComplete: vi.fn(),
    ...overrides,
  };
}

describe('PrefillStreamView', () => {
  it('continues to onboarding review with extracted fields after completion', async () => {
    vi.useFakeTimers();

    try {
      const onComplete = vi.fn();

      render(
        <PrefillStreamView
          {...createProps({
            partialResult: {
              companyName: { value: 'SaaSLaunch', confidence: 0.9 },
              businessModel: { value: 'B2B SaaS growth agency', confidence: 0.9 },
            },
            fieldsFound: 2,
            onComplete,
          })}
        />,
      );

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('Context extracted')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Review onboarding fields' }),
      ).toBeInTheDocument();
      expect(onComplete).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Review onboarding fields' }));

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: 'SaaSLaunch',
          businessModel: 'B2B SaaS growth agency',
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits for company deep research before opening the workspace', () => {
    const onComplete = vi.fn();

    const props = createProps({
      partialResult: {
        companyName: { value: 'SaaSLaunch', confidence: 0.9 },
        businessModel: { value: 'B2B SaaS growth agency', confidence: 0.9 },
      },
      fieldsFound: 2,
      deepResearchStatus: 'queued',
      onComplete,
    });

    const { rerender } = render(<PrefillStreamView {...props} />);

    expect(
      screen.getByText('Onboarding fields are extracted. Waiting for company deep research before workspace opens.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Review onboarding fields' }),
    ).not.toBeInTheDocument();

    rerender(
      <PrefillStreamView
        {...props}
        deepResearchFields={{
          companyName: 'SaaSLaunch',
          businessModel: 'B2B SaaS growth agency',
        }}
        deepResearchStatus="complete"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Review onboarding fields' }));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows the deep research agent activity stream while corpus is running', () => {
    render(
      <PrefillStreamView
        {...createProps({
          partialResult: {
            companyName: { value: 'SaaSLaunch', confidence: 0.9 },
          },
          fieldsFound: 1,
          deepResearchStatus: 'queued',
          deepResearchActivity: {
            jobId: 'job-deep',
            section: 'deepResearchProgram',
            status: 'running',
            tool: 'runDeepResearchProgram',
            startedAt: '2026-05-07T09:00:00.000Z',
            updates: [
              {
                at: '2026-05-07T09:00:01.000Z',
                id: 'update-1',
                message: 'Searching for company sources.',
                phase: 'tool',
              },
              {
                at: '2026-05-07T09:00:02.000Z',
                id: 'update-2',
                message: 'Synthesizing onboarding context.',
                phase: 'analysis',
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByTestId('deep-research-agent-view')).toHaveTextContent(
      'Deep research agent',
    );
    expect(screen.getByText('Build corpus')).toBeInTheDocument();
    expect(screen.getByText('Searching for company sources.')).toBeInTheDocument();
    expect(screen.getByText('Synthesizing onboarding context.')).toBeInTheDocument();
  });

  it('uses deep research onboarding fields over shallow extracted fields', () => {
    const onComplete = vi.fn();

    render(
      <PrefillStreamView
        {...createProps({
          partialResult: {
            companyName: {
              value: 'Airtable: Build Enterprise-ready AI Workflows, Apps & Agents',
              confidence: 0.6,
            },
            productDescription: {
              value:
                '500,000+ brands use Airtable to enable real-time collaboration.',
              confidence: 0.6,
            },
          },
          fieldsFound: 2,
          deepResearchFields: {
            companyName: 'Airtable',
            productDescription:
              'Airtable is an app platform for building workflows, connected data, automations, and AI-powered business applications.',
            topCompetitors: 'Smartsheet, Monday.com, Notion',
          },
          deepResearchStatus: 'complete',
          onComplete,
        })}
      />,
    );

    expect(screen.getByTestId('prefill-field-companyName')).toHaveTextContent('Airtable');
    expect(screen.getByTestId('prefill-field-companyName')).not.toHaveTextContent(
      'Build Enterprise-ready',
    );
    expect(screen.getByTestId('prefill-field-productDescription')).toHaveTextContent(
      'app platform for building workflows',
    );
    expect(screen.getByTestId('prefill-field-topCompetitors')).toHaveTextContent(
      'Smartsheet, Monday.com, Notion',
    );
    expect(screen.getByText('3 fields found')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Review onboarding fields' }));

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'Airtable',
        productDescription:
          'Airtable is an app platform for building workflows, connected data, automations, and AI-powered business applications.',
        topCompetitors: 'Smartsheet, Monday.com, Notion',
      }),
    );
  });

  it('opens review from deep research fields even while shallow prefill is still loading', () => {
    const onComplete = vi.fn();

    render(
      <PrefillStreamView
        {...createProps({
          partialResult: undefined,
          fieldsFound: 0,
          isPrefilling: true,
          deepResearchFields: {
            companyName: 'Airtable',
            productDescription:
              'Airtable is an app platform for building workflows and connected business applications.',
          },
          deepResearchStatus: 'complete',
          onComplete,
        })}
      />,
    );

    expect(screen.getByText('Context extracted')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Review onboarding fields' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Review onboarding fields' }));

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'Airtable',
        productDescription:
          'Airtable is an app platform for building workflows and connected business applications.',
      }),
    );
  });

  it('renders newly streamed fields inside the main container', async () => {
    const partialResult = {
      companyName: { value: 'SaaSLaunch', confidence: 0.9 },
    };

    const { rerender } = render(
      <PrefillStreamView
        {...createProps({
          partialResult,
          fieldsFound: 1,
          isPrefilling: true,
        })}
      />,
    );

    expect(screen.queryByTestId('prefill-latest-field')).not.toBeInTheDocument();
    expect(screen.getByTestId('prefill-field-companyName')).toHaveTextContent(
      'SaaSLaunch',
    );

    rerender(
      <PrefillStreamView
        {...createProps({
          partialResult: Object.assign(partialResult, {
            uniqueEdge: {
              value: 'We tie campaigns directly to pipeline attribution.',
              confidence: 0.9,
            },
          }),
          fieldsFound: 2,
          isPrefilling: true,
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('prefill-field-uniqueEdge')).toHaveTextContent(
        'We tie campaigns directly to pipeline attribution.',
      );
    });

    expect(screen.getByTestId('prefill-field-companyName')).toBeInTheDocument();
    expect(screen.getByTestId('prefill-field-uniqueEdge')).toBeInTheDocument();
  });

  it('does not render a separate latest-capture banner', () => {
    render(
      <PrefillStreamView
        {...createProps({
          partialResult: {
            companyName: { value: 'SaaSLaunch', confidence: 0.9 },
            demoUrl: {
              value: 'https://saaslaunch.net/old-home',
              confidence: 0.9,
            },
          },
          fieldsFound: 2,
          isPrefilling: true,
        })}
      />,
    );

    expect(screen.queryByTestId('prefill-latest-field')).not.toBeInTheDocument();
    expect(screen.getByTestId('prefill-field-companyName')).toBeInTheDocument();
    expect(screen.getByTestId('prefill-field-demoUrl')).toBeInTheDocument();
  });

  it('keeps completed fields in the launch context container', () => {
    render(
      <PrefillStreamView
        {...createProps({
          partialResult: {
            companyName: { value: 'SaaSLaunch', confidence: 0.9 },
            demoUrl: {
              value: 'https://saaslaunch.net/demo',
              confidence: 0.9,
            },
          },
          fieldsFound: 2,
          isPrefilling: false,
        })}
      />,
    );

    expect(screen.getByTestId('prefill-field-companyName')).toHaveTextContent('SaaSLaunch');
    expect(screen.getByTestId('prefill-field-demoUrl')).toHaveTextContent(
      'https://saaslaunch.net/demo',
    );
    expect(screen.queryByTestId('prefill-input-companyName')).not.toBeInTheDocument();
    expect(screen.queryByTestId('prefill-input-demoUrl')).not.toBeInTheDocument();
  });
});
