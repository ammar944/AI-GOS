import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AwarenessLevelCard } from '../awareness-level-card';
import { awarenessLevelFixture } from './test-fixtures';

describe('AwarenessLevelCard', () => {
  it('renders the awareness chip, directional share, evidence, and sample query source', () => {
    render(<AwarenessLevelCard level={awarenessLevelFixture} />);

    expect(screen.getByText('problem-aware')).toBeInTheDocument();
    expect(screen.getByText('~35%')).toBeInTheDocument();
    expect(
      screen.getByText('Queries cluster around pipeline attribution pain before vendor comparisons.'),
    ).toBeInTheDocument();
    expect(screen.getByText('why is pipeline attribution wrong')).toBeInTheDocument();
  });
});
