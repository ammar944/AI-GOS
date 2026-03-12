import { render, screen } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ScrapeLoadingCard } from '../scrape-loading-card';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('ScrapeLoadingCard', () => {
  it('uses prefill copy by default', () => {
    render(<ScrapeLoadingCard websiteUrl="https://saaslaunch.net" />);

    expect(screen.getByText('Analyzing')).toBeInTheDocument();
    expect(screen.getByText('Scraping site to pre-fill your profile')).toBeInTheDocument();
  });

  it('uses competitor-specific copy when mode is competitor', () => {
    render(
      <ScrapeLoadingCard
        websiteUrl="https://directiveconsulting.com"
        mode="competitor"
      />,
    );

    expect(screen.getByText('Profiling')).toBeInTheDocument();
    expect(
      screen.getByText('Pulling live competitor positioning and offer signals'),
    ).toBeInTheDocument();
    expect(screen.getByText('Structuring competitive intel')).toBeInTheDocument();
  });
});
