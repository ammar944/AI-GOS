import { describe, it, expect, vi } from 'vitest';
import { createSemaphore } from '../utils/semaphore';

describe('createSemaphore', () => {
  it('admits up to N concurrent holders', async () => {
    const sem = createSemaphore(2);
    const log: string[] = [];
    const task = async (id: string) => {
      const release = await sem.acquire();
      log.push(`enter ${id}`);
      await new Promise((r) => setTimeout(r, 50));
      log.push(`exit ${id}`);
      release();
    };
    await Promise.all([task('a'), task('b'), task('c'), task('d')]);
    expect(log[0]).toBe('enter a');
    expect(log[1]).toBe('enter b');
    expect(log[2]).toBe('exit a');
    expect(log[3]).toBe('enter c');
    expect(log[4]).toBe('exit b');
    expect(log[5]).toBe('enter d');
  });

  it('releases waiters as holders exit', async () => {
    const sem = createSemaphore(1);
    const order: number[] = [];
    const ops = Array.from({ length: 5 }, (_, i) => async () => {
      const release = await sem.acquire();
      order.push(i);
      await new Promise((r) => setTimeout(r, 10));
      release();
    });
    await Promise.all(ops.map((op) => op()));
    expect(order).toEqual([0, 1, 2, 3, 4]);
  });
});
