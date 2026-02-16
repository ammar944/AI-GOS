'use server'

import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { MediaPlanOutput } from '@/lib/media-plan/types'

export interface MediaPlanRecord {
  id: string
  user_id: string
  blueprint_id: string | null
  title: string
  output: MediaPlanOutput
  ad_copy: unknown | null
  generation_metadata: Record<string, unknown> | null
  status: string
  created_at: string
  updated_at: string
}

/**
 * Save a new media plan to the database
 */
export async function saveMediaPlanAction(params: {
  title: string
  blueprintId?: string
  output: MediaPlanOutput
  adCopy?: unknown
  metadata?: Record<string, unknown>
  status?: string
}): Promise<{ data?: MediaPlanRecord; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { error: 'Unauthorized' }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('media_plans')
    .insert({
      user_id: userId,
      blueprint_id: params.blueprintId || null,
      title: params.title,
      output: params.output as unknown,
      ad_copy: params.adCopy || null,
      generation_metadata: params.metadata || null,
      status: params.status || 'draft',
    })
    .select()
    .single()

  if (error) {
    console.error('[MediaPlans] Save error:', error)
    return { error: 'Failed to save media plan' }
  }

  revalidatePath('/dashboard')
  return { data: data as MediaPlanRecord }
}

/**
 * Update an existing media plan
 */
export async function updateMediaPlanAction(
  id: string,
  params: {
    adCopy?: unknown
    status?: string
  }
): Promise<{ data?: MediaPlanRecord; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { error: 'Unauthorized' }

  const supabase = createAdminClient()

  const updateData: Record<string, unknown> = {}
  if (params.adCopy !== undefined) updateData.ad_copy = params.adCopy
  if (params.status !== undefined) updateData.status = params.status

  const { data, error } = await supabase
    .from('media_plans')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('[MediaPlans] Update error:', error)
    return { error: 'Failed to update media plan' }
  }

  revalidatePath('/dashboard')
  return { data: data as MediaPlanRecord }
}

/**
 * Get all media plans for the current user
 */
export async function getUserMediaPlans(): Promise<{ data?: MediaPlanRecord[]; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { error: 'Unauthorized' }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('media_plans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[MediaPlans] Fetch error:', error)
    return { error: 'Failed to fetch media plans' }
  }

  return { data: data as MediaPlanRecord[] }
}

/**
 * Get a specific media plan by ID (must belong to current user)
 */
export async function getMediaPlanById(id: string): Promise<{ data?: MediaPlanRecord; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { error: 'Unauthorized' }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('media_plans')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('[MediaPlans] Fetch by ID error:', error)
    return { error: 'Media plan not found' }
  }

  return { data: data as MediaPlanRecord }
}
