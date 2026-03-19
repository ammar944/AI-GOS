'use server'

import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/server'
import { SECTION_PIPELINE } from '@/lib/workspace/pipeline'
import { CANONICAL_TO_BOUNDARY_SECTION_MAP } from '@/lib/journey/research-sections'
import { JOURNEY_FIELD_LABELS } from '@/lib/journey/field-catalog'
import type { SectionKey, CardState } from '@/lib/workspace/types'

export interface JourneySessionRecord {
  id: string
  title: string
  created_at: string
  completedSections: SectionKey[]
}

/**
 * Save compiled research document (all approved cards) to Supabase.
 * Called when all 6 research sections are approved in the workspace.
 *
 * Resilience notes:
 * - Guards against placeholder sessionId ('default') that indicates no real session
 * - Retries once after 1s for transient network/DB errors
 * - Treats missing column errors as non-fatal (migration not yet applied) and logs to console
 */
export async function saveResearchDocument(
  sessionId: string,
  cardsBySection: Record<string, CardState[]>,
): Promise<{ success: boolean; error?: string }> {
  // Guard: skip save if sessionId is a placeholder (no real session exists yet)
  if (!sessionId || sessionId === 'default') {
    console.warn('[saveResearchDocument] Skipping save — no valid session ID')
    return { success: true }
  }

  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Unauthorized' }

  const supabase = createAdminClient()

  // Verify ownership
  const { data: session, error: fetchError } = await supabase
    .from('journey_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !session) {
    console.warn('[saveResearchDocument] Session not found:', fetchError?.message)
    return { success: false, error: 'Session not found' }
  }

  const attemptUpdate = async (): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase
      .from('journey_sessions')
      .update({
        research_document: cardsBySection,
        document_saved_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (error) {
      // Column not found means the migration hasn't been applied to this environment.
      // Treat as a non-fatal soft failure — data is still in research_results.
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.warn(
          '[saveResearchDocument] research_document column missing — run migration 20260315_add_research_document_to_journey_sessions.sql',
        )
        return { success: true }
      }
      return { success: false, error: error.message }
    }
    return { success: true }
  }

  const first = await attemptUpdate()
  if (first.success) return first

  // Retry once after 1s for transient errors (network glitch, cold DB connection)
  await new Promise((resolve) => setTimeout(resolve, 1000))
  const second = await attemptUpdate()
  if (!second.success) {
    console.warn('[saveResearchDocument] Save failed after retry:', second.error)
  }
  return second
}

export async function getCompletedJourneySessions(): Promise<{
  data?: JourneySessionRecord[]
  error?: string
}> {
  const { userId } = await auth()
  if (!userId) return { error: 'Unauthorized' }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('journey_sessions')
    .select('id, created_at, metadata, research_results')
    .eq('user_id', userId)
    .not('research_results', 'is', null)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  if (!data) return { data: [] }

  // Build a reverse map: boundary ID → canonical IDs that map to it
  // so we can check both naming conventions in research_results
  const boundaryToCanonical = new Map<string, string[]>()
  for (const [canonical, boundary] of Object.entries(CANONICAL_TO_BOUNDARY_SECTION_MAP)) {
    const existing = boundaryToCanonical.get(boundary) ?? []
    existing.push(canonical)
    boundaryToCanonical.set(boundary, existing)
  }

  const records: JourneySessionRecord[] = data.map((row) => {
    const meta = row.metadata as Record<string, unknown> | null
    const results = row.research_results as Record<string, { status?: string }> | null

    const title =
      (meta?.companyName as string) ??
      (meta?.url as string) ??
      'Untitled Research'

    // Check both boundary IDs (industryMarket) and canonical IDs (industryResearch)
    const completedSections = SECTION_PIPELINE.filter((key) => {
      if (results?.[key]?.status === 'complete') return true
      const canonicalKeys = boundaryToCanonical.get(key) ?? []
      return canonicalKeys.some((ck) => results?.[ck]?.status === 'complete')
    })

    return {
      id: row.id,
      title,
      created_at: row.created_at,
      completedSections,
    }
  })

  return { data: records }
}

/**
 * Delete a journey session from Supabase.
 * Only the owning user can delete their sessions.
 */
export async function deleteJourneySession(
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Unauthorized' }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('journey_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Dispatch media plan generation for a completed research session.
 * Builds context from the session's onboarding metadata and dispatches
 * to the worker — no need to go through the journey flow again.
 */
export async function dispatchMediaPlanForSession(
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Unauthorized' }

  const supabase = createAdminClient()

  const { data: session, error: fetchError } = await supabase
    .from('journey_sessions')
    .select('id, metadata, research_results')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !session) {
    return { success: false, error: 'Session not found' }
  }

  const results = session.research_results as Record<string, { status?: string }> | null

  // Check if media plan already exists
  if (results?.mediaPlan?.status === 'complete' || results?.mediaPlan?.status === 'running') {
    return { success: false, error: 'Media plan already exists or is generating' }
  }

  // Build context from onboarding metadata
  const meta = session.metadata as Record<string, unknown> | null
  const contextLines: string[] = []
  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      if (key === 'activeJourneyRunId' || key === 'lastUpdated') continue
      if (typeof value === 'string' && value.trim()) {
        const label = JOURNEY_FIELD_LABELS[key] ?? key
        contextLines.push(`${label}: ${value}`)
      }
    }
  }

  const context = contextLines.length > 0
    ? contextLines.join('\n')
    : 'Generate media plan from approved research results'

  const runId = (meta?.activeJourneyRunId as string) ?? sessionId

  // Dispatch via the existing infrastructure
  const { dispatchResearchForUser } = await import('@/lib/ai/tools/research/dispatch')
  const result = await dispatchResearchForUser('researchMediaPlan', 'mediaPlan', context, userId, {
    activeRunId: runId,
  })

  if (result.status === 'error') {
    return { success: false, error: result.error ?? 'Failed to dispatch media plan' }
  }

  return { success: true }
}
