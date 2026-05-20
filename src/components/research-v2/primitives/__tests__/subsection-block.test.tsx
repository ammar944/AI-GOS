/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SubsectionBlock } from '../subsection-block';

describe('SubsectionBlock', () => {
  it('renders eyebrow label, narrative prose, and children, all tagged with data-testid', () => {
    render(
      <SubsectionBlock label="1 · Test" prose="Some prose.">
        <div data-testid="test-item">child</div>
      </SubsectionBlock>
    );
    const block = screen.getByTestId('subsection');
    expect(block).toHaveTextContent('1 · Test');
    expect(screen.getByTestId('subsection-prose')).toHaveTextContent('Some prose.');
    expect(screen.getByTestId('test-item')).toBeInTheDocument();
  });
});
