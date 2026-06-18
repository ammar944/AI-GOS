/** @vitest-environment jsdom */
import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Render the hover-card content inline so the portaled drawer body is in the
// DOM under test — the title leak (defect 3) only surfaces in that body.
vi.mock('@/components/ui/hover-card', () => ({
  HoverCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HoverCardTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HoverCardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { EvidenceChip } from '../evidence-chip';

describe('EvidenceChip', () => {
  it('renders a clean source title in the drawer body', () => {
    const { container } = render(
      <EvidenceChip
        source={{ title: 'G2 reviews', url: 'https://www.g2.com/x' }}
        label="source"
      />,
    );
    expect(container.textContent).toContain('G2 reviews');
  });

  it('never leaks a forbidden tool term from source.title', () => {
    const { container } = render(
      <EvidenceChip
        source={{ title: 'SpyFu keyword_volume', url: 'https://www.spyfu.com/x' }}
        label="source"
      />,
    );
    expect(container.textContent).not.toContain('keyword_volume');
  });
});
