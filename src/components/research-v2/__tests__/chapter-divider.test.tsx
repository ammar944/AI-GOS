/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChapterDivider } from '../chapter-divider';

describe('ChapterDivider', () => {
  it('renders zero-padded chapter number, eyebrow, and serif title', () => {
    render(
      <ChapterDivider
        chapterNumber={1}
        eyebrow="Market Category"
        title="A flattening work-OS landscape, increasingly defined from below."
      />
    );
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('Market Category')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/flattening work-OS/i);
  });

  it('zero-pads two-digit chapter numbers correctly', () => {
    render(<ChapterDivider chapterNumber={12} eyebrow="x" title="x" />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
