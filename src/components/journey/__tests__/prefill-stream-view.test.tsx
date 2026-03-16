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
  it('lets users edit extracted fields before continuing to review', async () => {
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
        screen.getByRole('button', { name: 'Review extracted fields' }),
      ).toBeInTheDocument();
      expect(onComplete).not.toHaveBeenCalled();

      fireEvent.change(screen.getByTestId('prefill-input-companyName'), {
        target: { value: 'SaaSLaunch AI' },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Review extracted fields' }));

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: 'SaaSLaunch AI',
          businessModel: 'B2B SaaS growth agency',
        }),
      );
    } finally {
      vi.useRealTimers();
    }
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

  it('switches completed fields into editable inputs in the same container', () => {
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

    expect(screen.getByTestId('prefill-input-companyName')).toHaveValue('SaaSLaunch');
    expect(screen.getByTestId('prefill-input-demoUrl')).toHaveValue(
      'https://saaslaunch.net/demo',
    );
  });
});
