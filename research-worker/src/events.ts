/**
 * Worker event bus — typed Node EventEmitter wrapper.
 *
 * Used to decouple the runner write path from the intelligence layer. When
 * a runner finishes and its wiki entries are written, the bus emits
 * `wiki:section-complete` and the intelligence dispatcher fans out card
 * jobs asynchronously.
 *
 * Subscriber failures are isolated via setImmediate — an exception in one
 * listener does not crash the emitter or other listeners.
 */
import { EventEmitter } from 'events';
import type { WikiEntry } from './wiki';

export interface WikiSectionCompleteEvent {
  userId: string;
  runId: string;
  section: string;
  entries: WikiEntry[];
  identityCard?: unknown;
}

export interface CardRenderedEvent {
  userId: string;
  runId: string;
  section: string;
  cardName: string;
  durationMs: number;
  model: string;
}

export interface CardGatedEvent {
  userId: string;
  runId: string;
  section: string;
  cardName: string;
  reason: string;
}

export interface WorkerEvents {
  'wiki:section-complete': WikiSectionCompleteEvent;
  'card:rendered': CardRenderedEvent;
  'card:gated': CardGatedEvent;
}

type EventName = keyof WorkerEvents;
type Listener<E extends EventName> = (payload: WorkerEvents[E]) => void | Promise<void>;

class WorkerBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Node emits a warning at 11+ listeners; the intelligence layer may
    // attach several. Lift the cap modestly.
    this.emitter.setMaxListeners(50);
  }

  on<E extends EventName>(event: E, listener: Listener<E>): this {
    const safe = (payload: WorkerEvents[E]) => {
      // Run in microtask so an exception never aborts the emit() caller.
      setImmediate(async () => {
        try {
          await listener(payload);
        } catch (err) {
          console.warn(`[events] listener for ${event} threw:`, err);
        }
      });
    };
    this.emitter.on(event as string, safe as (p: unknown) => void);
    return this;
  }

  emit<E extends EventName>(event: E, payload: WorkerEvents[E]): boolean {
    return this.emitter.emit(event as string, payload);
  }

  off<E extends EventName>(event: E, listener: Listener<E>): this {
    this.emitter.off(event as string, listener as (p: unknown) => void);
    return this;
  }

  /** Useful for tests — clear all listeners between cases. */
  removeAllListeners<E extends EventName>(event?: E): this {
    this.emitter.removeAllListeners(event as string | undefined);
    return this;
  }
}

/** Singleton bus used worker-wide. */
export const workerBus = new WorkerBus();
