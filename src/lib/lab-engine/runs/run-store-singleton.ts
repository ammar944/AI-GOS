import {
  createRunStore,
  type RunStore,
} from "./run-store";

let cachedStore: RunStore | null = null;

export function getRunStore(): RunStore {
  cachedStore ??= createRunStore();

  return cachedStore;
}

export function __setRunStoreForTesting(store: RunStore | null): void {
  cachedStore = store;
}
