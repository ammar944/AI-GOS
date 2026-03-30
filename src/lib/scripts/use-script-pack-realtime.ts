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

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    if (!packId) return;
    try {
      const res = await fetch(`/api/scripts/${packId}`);
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
        if (pack.status === 'complete' && onComplete) {
          onComplete({ status: pack.status, scripts });
        }
      }
    } catch {
      /* silently retry */
    }
  }, [packId, onComplete, stopPolling]);

  useEffect(() => {
    if (!packId || !enabled) return;
    setState({ status: 'generating', scripts: [] });
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);
    return () => {
      stopPolling();
    };
  }, [packId, enabled, poll, stopPolling]);

  return state;
}
