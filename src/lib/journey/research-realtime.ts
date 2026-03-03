'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ResearchSectionResult {
  status: 'complete' | 'error';
  section: string;
  data?: unknown;
  error?: string;
  durationMs: number;
}

interface UseResearchRealtimeOptions {
  userId: string | null | undefined;
  onSectionComplete: (section: string, result: ResearchSectionResult) => void;
  onAllSectionsComplete?: (
    allResults: Record<string, ResearchSectionResult>,
  ) => void;
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
  onSectionComplete,
  onAllSectionsComplete,
}: UseResearchRealtimeOptions) {
  const seenSections = useRef<Set<string>>(new Set());
  const seenResults = useRef<Record<string, ResearchSectionResult>>({});
  const synthesisTriggered = useRef(false);
  const onSectionCompleteRef = useRef(onSectionComplete);
  const onAllSectionsCompleteRef = useRef(onAllSectionsComplete);
  onSectionCompleteRef.current = onSectionComplete;
  onAllSectionsCompleteRef.current = onAllSectionsComplete;

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

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

    // On mount, check for already-completed sections (page refresh case)
    supabase
      .from('journey_sessions')
      .select('research_results')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
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
          const results = (payload.new as Record<string, unknown>)
            .research_results as Record<
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
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
