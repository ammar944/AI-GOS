import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetStyleRefs } from '../asset-style-refs';
import type { StyleReference } from '@/lib/profiles/business-profiles';

describe('AssetStyleRefs', () => {
  it('renders HOW IT WORKS section and add button', () => {
    render(<AssetStyleRefs refs={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/HOW IT WORKS/i)).toBeDefined();
    expect(screen.getByText(/Add reference ad/i)).toBeDefined();
  });

  it('renders existing style references', () => {
    const refs: StyleReference[] = [
      { name: 'Winning FB Ad', content: 'Stop scrolling. Your CAC is too high.', source: 'facebook' },
      { name: 'VSL Script', content: 'What if I told you...', source: 'youtube' },
    ];
    render(<AssetStyleRefs refs={refs} onChange={vi.fn()} />);

    expect(screen.getByText('Winning FB Ad')).toBeDefined();
    expect(screen.getByText('VSL Script')).toBeDefined();
  });

  it('shows add form when add button is clicked', () => {
    render(<AssetStyleRefs refs={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText(/Add reference ad/i));

    // Form inputs should appear
    expect(screen.getByPlaceholderText(/Winning VSL/i)).toBeDefined();
  });

  it('disables add button when disabled', () => {
    render(<AssetStyleRefs refs={[]} onChange={vi.fn()} disabled />);
    const addBtn = screen.getByText(/Add reference ad/i);
    expect(addBtn.closest('button')?.disabled).toBe(true);
  });
});
