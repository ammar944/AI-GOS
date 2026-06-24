import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  StrategistMemo,
  readStrategistMemo,
} from '../strategist-memo';

describe('StrategistMemo', () => {
  it('renders nothing when the memo is empty', () => {
    const { container } = render(<StrategistMemo memo="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the trigger + markdown body when the memo has content', () => {
    render(<StrategistMemo memo="## Strategist readout\n\nThe plan leads with proof." />);
    expect(screen.getByText('Full strategist memo')).toBeTruthy();
    expect(screen.getByText('Expand')).toBeTruthy();
    // the markdown body renders as formatted prose (no raw ##)
    expect(screen.queryByText(/## Strategist readout/)).toBeNull();
  });
});

describe('readStrategistMemo', () => {
  it('reads the memo from the flattened root', () => {
    expect(readStrategistMemo({ strategistMemo: 'memo body' })).toBe('memo body');
  });

  it('reads the memo from artifact.body when the root has none', () => {
    expect(
      readStrategistMemo({ body: { strategistMemo: 'nested memo' } }),
    ).toBe('nested memo');
  });

  it('prefers the root memo over the body memo', () => {
    expect(
      readStrategistMemo({
        strategistMemo: 'root memo',
        body: { strategistMemo: 'nested memo' },
      }),
    ).toBe('root memo');
  });

  it('returns empty string when no memo is present', () => {
    expect(readStrategistMemo({})).toBe('');
    expect(readStrategistMemo({ body: { other: 'x' } })).toBe('');
  });

  it('ignores non-string memo values', () => {
    expect(readStrategistMemo({ strategistMemo: 42 })).toBe('');
    expect(readStrategistMemo({ body: { strategistMemo: null } })).toBe('');
  });
});