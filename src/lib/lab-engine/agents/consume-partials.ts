export interface ConsumePartialsParams {
  abortSignal: AbortSignal;
  iterable: AsyncIterable<unknown>;
  onFirstChunk: () => void;
  onPartial: (partial: unknown) => void;
}

// AI SDK's timeout.chunkMs is not honored by all provider adapters and even
// when honored does not catch the case where the provider holds the HTTP
// connection open without emitting tokens. This helper races every
// iterator.next() against abortSignal so the caller's own timer can break
// the loop at any point — pre-first-chunk hang, mid-stream stall, or anything
// in between. The caller owns the timer and resets it from onFirstChunk and
// onPartial. A clean stream end is left as a benign path; the caller can
// still resolve the final output through its own timeout-guarded await.
export async function consumePartialsUntilAbort({
  abortSignal,
  iterable,
  onFirstChunk,
  onPartial,
}: ConsumePartialsParams): Promise<void> {
  const iterator = iterable[Symbol.asyncIterator]();
  let firstChunkSeen = false;
  let abortListener: (() => void) | undefined;

  const abortPromise = new Promise<never>((_, reject) => {
    if (abortSignal.aborted) {
      reject(toError(abortSignal.reason));
      return;
    }
    abortListener = (): void => {
      reject(toError(abortSignal.reason));
    };
    abortSignal.addEventListener("abort", abortListener);
  });
  // Prevent unhandled-rejection if the abort fires after the iterator has
  // already resolved naturally.
  abortPromise.catch((): void => undefined);

  try {
    while (true) {
      const result = await Promise.race([iterator.next(), abortPromise]);

      if (result.done === true) {
        return;
      }

      if (!firstChunkSeen) {
        firstChunkSeen = true;
        onFirstChunk();
      }
      onPartial(result.value);
    }
  } finally {
    if (abortListener !== undefined) {
      abortSignal.removeEventListener("abort", abortListener);
    }
  }
}

function toError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }
  return new Error(reason === undefined ? "consume signal aborted" : String(reason));
}
