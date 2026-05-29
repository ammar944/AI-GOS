import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PositioningTypedArtifact } from '@/types/positioning-artifact';

import { TypedArtifactRenderer } from '../typed-artifact-renderer';

// An unknown zoneId falls through the dispatch switch to the generic
// reflection renderer, which owns the source list whose key was fixed.
const GENERIC_ZONE_ID = 'genericFallbackZone';

describe('TypedArtifactRenderer (generic source list)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces unique keys when multiple sources share the same URL', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const duplicateUrl = 'https://saaslaunch.net/';
    const artifact: PositioningTypedArtifact = {
      sectionTitle: 'Generic Section',
      verdict: 'Verdict prose.',
      statusSummary: 'Status summary prose.',
      confidence: 7,
      sources: [
        { title: 'SaaS Launch — page A', url: duplicateUrl },
        { title: 'SaaS Launch — page B', url: duplicateUrl },
        { title: 'SaaS Launch — page C', url: duplicateUrl },
      ],
    };

    render(<TypedArtifactRenderer artifact={artifact} zoneId={GENERIC_ZONE_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sources (3)' }));
    const sources = screen.getByRole('list');
    expect(within(sources).getByText('SaaS Launch — page A')).toBeInTheDocument();
    expect(within(sources).getByText('SaaS Launch — page B')).toBeInTheDocument();
    expect(within(sources).getByText('SaaS Launch — page C')).toBeInTheDocument();

    const keyWarnings = errorSpy.mock.calls.filter(([message]) =>
      typeof message === 'string' ? message.includes('same key') : false,
    );
    expect(keyWarnings).toEqual([]);
  });
});
