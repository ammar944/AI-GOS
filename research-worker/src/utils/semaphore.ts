/**
 * Minimal counting semaphore. Returns a release function from acquire().
 * Waiters are admitted in FIFO order as holders release.
 */
export function createSemaphore(max: number) {
  let available = max;
  const waiters: Array<() => void> = [];

  const acquire = (): Promise<() => void> => {
    return new Promise((resolve) => {
      const tryAdmit = () => {
        if (available > 0) {
          available -= 1;
          let released = false;
          resolve(() => {
            if (released) return;
            released = true;
            available += 1;
            const next = waiters.shift();
            if (next) next();
          });
        } else {
          waiters.push(tryAdmit);
        }
      };
      tryAdmit();
    });
  };

  return { acquire };
}
