/** @vitest-environment jsdom */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DecisionCard } from '../decision-card';

describe('DecisionCard', () => {
  it('renders the move and a clean meta line', () => {
    const { container } = render(
      <DecisionCard
        number={1}
        move="Launch the verified comparison campaign."
        meta="Proven by demand and competitor evidence."
      />,
    );
    expect(container.textContent).toContain(
      'Launch the verified comparison campaign.',
    );
    expect(container.textContent).toContain(
      'Proven by demand and competitor evidence.',
    );
  });

  it('never leaks a pipeline-chrome term from meta', () => {
    const { container } = render(
      <DecisionCard
        number={1}
        move="Launch the verified comparison campaign."
        meta="evidence gap: narrative removed because the blockGap floor was unmet"
      />,
    );
    expect(container.textContent).not.toContain('evidence gap:');
    expect(container.textContent).not.toContain('blockGap');
  });
});
