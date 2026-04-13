'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseScriptPackRealtimeOpts {
  packId: string | null;
  enabled?: boolean;
  onComplete?: (state: ScriptPackState) => void;
}

export interface ScriptPackState {
  status: 'idle' | 'generating' | 'partial' | 'complete' | 'error';
  scripts: unknown[];
  errorMessage?: string;
}

const POLL_INTERVAL = 2000;
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function useScriptPackRealtime({
  packId,
  enabled = true,
  onComplete,
}: UseScriptPackRealtimeOpts) {
  const [state, setState] = useState<ScriptPackState>({ status: 'idle', scripts: [] });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const packIdRef = useRef<string | null>(packId);
  const prevPackIdRef = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    packIdRef.current = packId;
    onCompleteRef.current = onComplete;
  }, [packId, onComplete]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    const id = packIdRef.current;
    if (!id) return;
    try {
      const res = await fetch(`/api/scripts/${id}`);
      if (!res.ok) return;
      const { pack } = await res.json();
      const scripts = typeof pack.scripts === 'string' ? JSON.parse(pack.scripts) : pack.scripts;

      // Detect stale packs — if still 'generating' with no scripts after 5 minutes, treat as error
      if (pack.status === 'generating' && (!scripts || scripts.length === 0)) {
        const createdAt = new Date(pack.created_at).getTime();
        if (Date.now() - createdAt > STALE_THRESHOLD_MS) {
          setState({
            status: 'error',
            scripts: [],
            errorMessage: 'Generation timed out — the worker may not have received the request. Try again.',
          });
          stopPolling();
          return;
        }
      }

      setState({
        status: pack.status,
        scripts: scripts ?? [],
        errorMessage: pack.error_message ?? undefined,
      });
      if (pack.status === 'complete' || pack.status === 'error') {
        stopPolling();
        if (pack.status === 'complete' && onCompleteRef.current) {
          onCompleteRef.current({ status: pack.status, scripts });
        }
      }
    } catch {
      /* silently retry */
    }
  }, [stopPolling]);

  useEffect(() => {
    if (!packId) {
      prevPackIdRef.current = null;
    }
    if (!packId || !enabled) {
      stopPolling();
      return;
    }

    if (prevPackIdRef.current !== packId) {
      prevPackIdRef.current = packId;
      // Sync hook state to a new pack id — not derivable from props alone (poll fills scripts)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on packId change
      setState({ status: 'generating', scripts: [] });
    }

    void poll();
    intervalRef.current = setInterval(() => {
      void poll();
    }, POLL_INTERVAL);
    return () => {
      stopPolling();
    };
  }, [packId, enabled, poll, stopPolling]);

  return state;
}
