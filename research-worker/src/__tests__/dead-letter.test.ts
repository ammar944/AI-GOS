import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';

vi.mock('fs', () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe('writeDeadLetter', () => {
  it('writes a JSON file to the dead-letters directory', async () => {
    const { writeDeadLetter } = await import('../dead-letter.js');
    writeDeadLetter('user-123', 'industryMarket', { data: 'test' }, 'Supabase timeout');

    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('dead-letters/'),
      expect.stringContaining('"userId": "user-123"'),
    );
  });
});
