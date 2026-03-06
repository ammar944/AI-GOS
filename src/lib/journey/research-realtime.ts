'use client';

import { useEffect, useRef } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';

export interface ResearchSectionResult {
  status: 'complete' | 'error';
  section: string;
  data?: unknown;
  error?: string;
  durationMs: number;
}

interface UseResearchRealtimeOptions {
  userId: string | null | undefined;
  sessionId?: string | null;
  onSectionComplete: (section: string, result: ResearchSectionResult) => void;
  onAllSectionsComplete?: (
    allResults: Record<string, ResearchSectionResult>,
  ) => void;
  onTimeout?: (pendingSections: string[]) => void;
  timeoutMs?: number;
}

const SYNTHESIS_PREREQUISITES = new Set([
  'industryMarket',
  'competitors',
  'icpValidation',
  'offerAnalysis',
]);

/**
 * Subscribe to Supabase Realtime for research results.
 * Calls onSectionComplete whenever a new section arrives in journey_sessions.research_results.
 * Calls onAllSectionsComplete when all 4 prerequisite sections are complete.
 */
export function useResearchRealtime({
  userId,
  sessionId,
  onSectionComplete,
  onAllSectionsComplete,
  onTimeout,
  timeoutMs,
}: UseResearchRealtimeOptions) {
  const seenSections = useRef<Set<string>>(new Set());
  const seenResults = useRef<Record<string, ResearchSectionResult>>({});
  const synthesisTriggered = useRef(false);
  const onSectionCompleteRef = useRef(onSectionComplete);
  const onAllSectionsCompleteRef = useRef(onAllSectionsComplete);
  const onTimeoutRef = useRef(onTimeout);
  onSectionCompleteRef.current = onSectionComplete;
  onAllSectionsCompleteRef.current = onAllSectionsComplete;
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    // Reset tracking state when session changes (new conversation)
    seenSections.current = new Set();
    seenResults.current = {};
    synthesisTriggered.current = false;

    if (!userId || !sessionId) return;

    const supabase = getBrowserClient();

    const timeout = setTimeout(() => {
      const pending = [...SYNTHESIS_PREREQUISITES].filter(
        (s) => !seenSections.current.has(s),
      );
      if (pending.length > 0) {
        onTimeoutRef.current?.(pending);
      }
    }, timeoutMs ?? 3 * 60 * 1000);

    function handleNewSection(
      section: string,
      result: ResearchSectionResult,
    ) {
      if (seenSections.current.has(section)) return;
      seenSections.current.add(section);
      seenResults.current = { ...seenResults.current, [section]: result };
      onSectionCompleteRef.current(section, result);

      // Check if all 4 synthesis prerequisites are complete
      const allResults = seenResults.current;
      const completedPrereqs = [...SYNTHESIS_PREREQUISITES].filter(
        (s) => allResults[s]?.status === 'complete',
      );
      if (
        completedPrereqs.length === SYNTHESIS_PREREQUISITES.size &&
        !synthesisTriggered.current
      ) {
        synthesisTriggered.current = true;
        onAllSectionsCompleteRef.current?.(allResults);
      }
    }

    // On mount, check for already-completed sections (page refresh / resume case).
    // Only load when we have a specific session to scope to — prevents stale
    // research results from a previous conversation leaking into a fresh one.
    if (sessionId) {
      supabase
        .from('journey_sessions')
        .select('research_results')
        .eq('id', sessionId)
        .maybeSingle()
        .then(({ data }) => {
          if (!data?.research_results) return;
          const results = data.research_results as Record<
            string,
            ResearchSectionResult
          >;
          for (const [section, result] of Object.entries(results)) {
            handleNewSection(section, result);
          }
        });
    }

    // Subscribe to future changes
    const channel = supabase
      .channel(`research-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'journey_sessions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          // When scoped to a session, ignore updates from other sessions
          if (sessionId && row.id !== sessionId) return;
          const results = row.research_results as Record<
            string,
            ResearchSectionResult
          > | null;
          if (!results) return;
          for (const [section, result] of Object.entries(results)) {
            handleNewSection(section, result);
          }
        },
      )
      .subscribe();

    return () => {
      clearTimeout(timeout);
      supabase.removeChannel(channel).then(() => {
        if (supabase.getChannels().length === 0) {
          supabase.realtime.disconnect();
        }
      });
    };
  }, [userId, sessionId, timeoutMs]);
}
