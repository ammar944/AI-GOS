import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetBrandVoice } from '../asset-brand-voice';
import type { BrandVoiceNotes } from '@/lib/profiles/business-profiles';

const EMPTY_NOTES: BrandVoiceNotes = { tone: '', constraints: '', goodExample: '', badExample: '' };

describe('AssetBrandVoice', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('renders tone chips, rules input, and example sections', () => {
    render(<AssetBrandVoice value={null} onChange={vi.fn()} />);

    expect(screen.getByText('Authoritative')).toBeDefined();
    expect(screen.getByText('Conversational')).toBeDefined();
    expect(screen.getByText('Premium')).toBeDefined();
    expect(screen.getByText(/sounds like us/i)).toBeDefined();
    expect(screen.getByText(/NOT us/i)).toBeDefined();
  });

  it('calls onChange (debounced) when a tone chip is clicked', () => {
    const onChange = vi.fn();
    render(<AssetBrandVoice value={EMPTY_NOTES} onChange={onChange} />);

    fireEvent.click(screen.getByText('Authoritative'));
    vi.advanceTimersByTime(600);

    expect(onChange).toHaveBeenCalledTimes(1);
    const call = onChange.mock.calls[0][0] as BrandVoiceNotes;
    expect(call.tone).toContain('Authoritative');
  });

  it('deselects a tone chip when clicked again', () => {
    const onChange = vi.fn();
    render(
      <AssetBrandVoice
        value={{ ...EMPTY_NOTES, tone: '[Authoritative]' }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByText('Authoritative'));
    vi.advanceTimersByTime(600);

    expect(onChange).toHaveBeenCalledTimes(1);
    const call = onChange.mock.calls[0][0] as BrandVoiceNotes;
    expect(call.tone).not.toContain('Authoritative');
  });

  it('adds a rule via the add button after typing', () => {
    const onChange = vi.fn();
    render(<AssetBrandVoice value={EMPTY_NOTES} onChange={onChange} />);

    const input = screen.getByPlaceholderText(/rule/i);
    fireEvent.change(input, { target: { value: 'Never use jargon' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    vi.advanceTimersByTime(600);

    expect(onChange).toHaveBeenCalled();
    const call = onChange.mock.calls[0][0] as BrandVoiceNotes;
    expect(call.constraints).toContain('Never use jargon');
  });

  it('renders with pre-populated values', () => {
    const value: BrandVoiceNotes = {
      tone: '[Data-driven, Technical]',
      constraints: 'ALWAYS: Use specific numbers\nNEVER: Say "game-changer"',
      goodExample: 'We reduced churn by 23%.',
      badExample: 'Revolutionary solution!',
    };
    render(<AssetBrandVoice value={value} onChange={vi.fn()} />);

    expect(screen.getByText('Data-driven')).toBeDefined();
    expect(screen.getByText('Technical')).toBeDefined();
  });

  it('disables interactions when disabled prop is true', () => {
    const onChange = vi.fn();
    render(<AssetBrandVoice value={EMPTY_NOTES} onChange={onChange} disabled />);

    fireEvent.click(screen.getByText('Authoritative'));
    vi.advanceTimersByTime(600);

    expect(onChange).not.toHaveBeenCalled();
  });
});
