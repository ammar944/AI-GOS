import type { UIMessage } from 'ai';

// =============================================================================
// Types
// =============================================================================

export interface ConversationBranch {
  id: string;
  parentMessageId: string; // message where branch was created
  messages: UIMessage[];   // messages in this branch (from fork point onward — includes all messages up to and including the fork message)
  label: string;           // user-assigned label or auto "Branch 1"
  createdAt: string;       // ISO string
}

export interface BranchState {
  mainThread: UIMessage[];
  branches: ConversationBranch[];
  activeBranchId: string | null; // null = main thread
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate an auto-label for a new branch based on the current count.
 * "Branch 1", "Branch 2", etc.
 */
function generateLabel(branches: ConversationBranch[]): string {
  // Find the highest existing auto-label number to avoid collisions after deletes
  let max = 0;
  for (const branch of branches) {
    const match = branch.label.match(/^Branch (\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return `Branch ${max + 1}`;
}

/**
 * Find the index of a message by its id. Returns -1 if not found.
 */
function findMessageIndex(messages: UIMessage[], messageId: string): number {
  return messages.findIndex((m) => m.id === messageId);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Wrap an existing message array into a fresh BranchState with no branches.
 */
export function createInitialBranchState(messages: UIMessage[]): BranchState {
  return {
    mainThread: messages,
    branches: [],
    activeBranchId: null,
  };
}

/**
 * Fork a new branch from a specific message.
 *
 * The new branch receives a copy of all messages up to and including
 * `fromMessageId` (sliced from whichever thread is currently active).
 * After creation the active branch is switched to the new branch so the
 * caller can immediately start appending messages to it.
 *
 * Returns a new BranchState — immutable, never mutates input.
 */
export function createBranch(
  state: BranchState,
  fromMessageId: string,
  label?: string
): BranchState {
  const sourceMessages = getActiveMessages(state);
  const idx = findMessageIndex(sourceMessages, fromMessageId);

  // Guard: message not found in the active thread — return unchanged
  if (idx === -1) {
    console.warn(`[branching] createBranch: message "${fromMessageId}" not found in active thread`);
    return state;
  }

  // Messages up to and including the fork point become the branch seed
  const seedMessages: UIMessage[] = sourceMessages.slice(0, idx + 1).map((m) => ({
    ...m,
    // Shallow-copy parts so downstream mutations on one branch don't affect
    // the other. Parts are plain serializable objects so this is sufficient.
    parts: [...m.parts],
  }));

  const newBranch: ConversationBranch = {
    id: crypto.randomUUID(),
    parentMessageId: fromMessageId,
    messages: seedMessages,
    label: label?.trim() || generateLabel(state.branches),
    createdAt: new Date().toISOString(),
  };

  return {
    ...state,
    branches: [...state.branches, newBranch],
    activeBranchId: newBranch.id,
  };
}

/**
 * Switch the active branch.
 * Pass `null` to return to the main thread.
 */
export function switchBranch(
  state: BranchState,
  branchId: string | null
): BranchState {
  if (branchId === null) {
    return { ...state, activeBranchId: null };
  }

  const exists = state.branches.some((b) => b.id === branchId);
  if (!exists) {
    console.warn(`[branching] switchBranch: branch "${branchId}" does not exist`);
    return state;
  }

  return { ...state, activeBranchId: branchId };
}

/**
 * Permanently remove a branch by id.
 * If the deleted branch was active, falls back to main thread.
 */
export function deleteBranch(
  state: BranchState,
  branchId: string
): BranchState {
  const filtered = state.branches.filter((b) => b.id !== branchId);
  const activeBranchId =
    state.activeBranchId === branchId ? null : state.activeBranchId;

  return {
    ...state,
    branches: filtered,
    activeBranchId,
  };
}

/**
 * Return the message list for the currently active branch or main thread.
 */
export function getActiveMessages(state: BranchState): UIMessage[] {
  if (state.activeBranchId === null) {
    return state.mainThread;
  }

  const branch = state.branches.find((b) => b.id === state.activeBranchId);
  if (!branch) {
    // Stale activeBranchId — fall back gracefully
    return state.mainThread;
  }

  return branch.messages;
}

/**
 * Append a message to whichever thread is currently active.
 * Returns a new BranchState.
 */
export function addMessageToActiveBranch(
  state: BranchState,
  message: UIMessage
): BranchState {
  if (state.activeBranchId === null) {
    return {
      ...state,
      mainThread: [...state.mainThread, message],
    };
  }

  const updatedBranches = state.branches.map((b) => {
    if (b.id !== state.activeBranchId) return b;
    return {
      ...b,
      messages: [...b.messages, message],
    };
  });

  return {
    ...state,
    branches: updatedBranches,
  };
}

/**
 * Return the total number of branches (not counting main thread).
 */
export function getBranchCount(state: BranchState): number {
  return state.branches.length;
}

/**
 * Return all branches that fork from a specific message id.
 * Useful for rendering branch indicators next to messages.
 */
export function getBranchesForMessage(
  state: BranchState,
  messageId: string
): ConversationBranch[] {
  return state.branches.filter((b) => b.parentMessageId === messageId);
}
