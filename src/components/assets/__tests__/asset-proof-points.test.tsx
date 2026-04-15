import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetProofPoints } from '../asset-proof-points';
import type { ProofPoint } from '@/lib/profiles/business-profiles';

describe('AssetProofPoints', () => {
  it('renders WHY THIS MATTERS section and add button', () => {
    render(<AssetProofPoints points={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/WHY THIS MATTERS/i)).toBeDefined();
    expect(screen.getByText(/Add Proof Point/i)).toBeDefined();
  });

  it('renders existing proof points', () => {
    const points: ProofPoint[] = [
      { id: '1', type: 'metric', headline: '40% CAC reduction', detail: 'Achieved in 90 days', verified: true },
      { id: '2', type: 'testimonial', headline: 'CEO Quote', detail: 'Best tool we ever used', clientName: 'Acme', verified: false },
    ];
    render(<AssetProofPoints points={points} onChange={vi.fn()} />);

    expect(screen.getByText('40% CAC reduction')).toBeDefined();
    expect(screen.getByText('CEO Quote')).toBeDefined();
  });

  it('shows add form when add button is clicked', () => {
    render(<AssetProofPoints points={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText(/Add Proof Point/i));

    // Form should appear with type selector and inputs
    expect(screen.getByPlaceholderText(/3 demos to 22/i)).toBeDefined();
  });

  it('disables add button when disabled', () => {
    render(<AssetProofPoints points={[]} onChange={vi.fn()} disabled />);
    const addBtn = screen.getByText(/Add Proof Point/i);
    expect(addBtn.closest('button')?.disabled).toBe(true);
  });
});
