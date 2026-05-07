import { render, screen, fireEvent } from '@testing-library/react';
import type { HTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PrefillStreamView } from '@/components/journey/prefill-stream-view';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => {
      const cleanProps = { ...props };
      delete cleanProps.initial;
      delete cleanProps.animate;
      delete cleanProps.transition;
      return <div {...cleanProps}>{children}</div>;
    },
  },
}));

describe('PrefillStreamView', () => {
  it('shows visible agent activity while deep research is running', () => {
    render(
      <PrefillStreamView
        websiteUrl="https://saaslaunch.net"
        deepResearchStatus="queued"
        deepResearchActivity={{
          jobId: 'job-deep',
          section: 'deepResearchProgram',
          status: 'running',
          tool: 'runDeepResearchProgram',
          startedAt: '2026-05-07T09:00:00.000Z',
          updates: [
            {
              at: '2026-05-07T09:00:01.000Z',
              id: 'update-1',
              message: 'Searching company sources.',
              phase: 'tool',
            },
            {
              at: '2026-05-07T09:00:02.000Z',
              id: 'update-2',
              message: 'Extracting source-backed profile fields.',
              phase: 'analysis',
            },
          ],
        }}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText('agent writing')).toBeInTheDocument();
    expect(screen.getByTestId('deep-research-agent-view')).toHaveTextContent(
      'Research & thinking',
    );
    expect(screen.getByText('Building company corpus')).toBeInTheDocument();
    expect(screen.getByText('Searching company sources.')).toBeInTheDocument();
    expect(
      screen.getByText('Extracting source-backed profile fields.'),
    ).toBeInTheDocument();
  });

  it('renders deep research onboardingFields as the launch source of truth', () => {
    render(
      <PrefillStreamView
        websiteUrl="https://airtable.com"
        deepResearchStatus="complete"
        deepResearchFields={{
          companyName: 'Airtable',
          productDescription:
            'Airtable is an app platform for workflows, connected data, automations, and AI-powered business applications.',
          topCompetitors: 'Smartsheet, Monday.com, Notion',
        }}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText('corpus ready')).toBeInTheDocument();
    expect(screen.getByTestId('prefill-field-companyName')).toHaveTextContent(
      'Airtable',
    );
    expect(screen.getByTestId('prefill-field-productDescription')).toHaveTextContent(
      'app platform for workflows',
    );
    expect(screen.getByTestId('prefill-field-topCompetitors')).toHaveTextContent(
      'Smartsheet, Monday.com, Notion',
    );
    expect(
      screen.queryByRole('button', { name: /Review onboarding fields/i }),
    ).not.toBeInTheDocument();
  });

  it('keeps failed deep research on the running surface with retry', () => {
    const onRetry = vi.fn();

    render(
      <PrefillStreamView
        websiteUrl="https://bad-url.test"
        deepResearchStatus="error"
        deepResearchError="Worker returned no usable onboardingFields"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('research failed')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Deep research failed before workspace launch: Worker returned no usable onboardingFields',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try another URL' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
