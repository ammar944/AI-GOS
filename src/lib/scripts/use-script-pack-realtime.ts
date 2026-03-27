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

export function useScriptPackRealtime({
  packId,
  enabled = true,
  onComplete,
}: UseScriptPackRealtimeOpts) {
  const [state, setState] = useState<ScriptPackState>({ status: 'idle', scripts: [] });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    if (!packId) return;
    try {
      const res = await fetch(`/api/scripts/${packId}`);
      if (!res.ok) return;
      const { pack } = await res.json();
      const scripts = typeof pack.scripts === 'string' ? JSON.parse(pack.scripts) : pack.scripts;
      setState({
        status: pack.status,
        scripts: scripts ?? [],
        errorMessage: pack.error_message ?? undefined,
      });
      if (pack.status === 'complete' || pack.status === 'error') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (pack.status === 'complete' && onComplete) {
          onComplete({ status: pack.status, scripts });
        }
      }
    } catch {
      /* silently retry */
    }
  }, [packId, onComplete]);

  useEffect(() => {
    if (!packId || !enabled) return;
    setState({ status: 'generating', scripts: [] });
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [packId, enabled, poll]);

  return state;
}
