/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GapNote } from '../gap-note';

describe('GapNote', () => {
  it('renders a clean honest summary as children', () => {
    render(<GapNote>No buyer questions cleared the bar this run.</GapNote>);
    expect(
      screen.getByText('No buyer questions cleared the bar this run.'),
    ).toBeInTheDocument();
  });

  it('never leaks a forbidden tool term from string children', () => {
    const { container } = render(
      <GapNote>
        {"A web_search for 'Ramp vs spend management reddit' returned nothing."}
      </GapNote>,
    );
    expect(container.textContent).not.toContain('web_search');
  });

  it('never leaks a forbidden tool term from howToClose', () => {
    const { container } = render(
      <GapNote
        subject="buyer questions"
        howToClose="Search Reddit via web_search for 'ramp spend management'."
      />,
    );
    expect(container.textContent).not.toContain('web_search');
  });
});
