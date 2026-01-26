'use server'

import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { StrategicBlueprintOutput } from '@/lib/strategic-blueprint/output-types'
import type { OnboardingFormData } from '@/lib/onboarding/types'

export interface BlueprintRecord {
  id: string
  user_id: string
  title: string
  input_data: OnboardingFormData
  output: StrategicBlueprintOutput
  generation_metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/**
 * Save a new blueprint to the database
 * Uses admin client to bypass RLS (safe since we validate userId via Clerk)
 */
export async function saveBlueprint(params: {
  title: string
  inputData: OnboardingFormData
  output: StrategicBlueprintOutput
  metadata?: Record<string, unknown>
}): Promise<{ data?: BlueprintRecord; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { error: 'Unauthorized' }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('blueprints')
    .insert({
      user_id: userId,
      title: params.title,
      input_data: params.inputData as unknown,
      output: params.output as unknown,
      generation_metadata: params.metadata || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[Blueprints] Save error:', error)
    return { error: 'Failed to save blueprint' }
  }

  revalidatePath('/dashboard')
  return { data: data as BlueprintRecord }
}

/**
 * Get all blueprints for the current user
 * Uses admin client to bypass RLS (safe since we validate userId via Clerk)
 */
export async function getUserBlueprints(): Promise<{ data?: BlueprintRecord[]; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { error: 'Unauthorized' }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('blueprints')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Blueprints] Fetch error:', error)
    return { error: 'Failed to fetch blueprints' }
  }

  return { data: data as BlueprintRecord[] }
}

/**
 * Get a specific blueprint by ID (must belong to current user)
 * Uses admin client to bypass RLS (safe since we validate userId via Clerk)
 */
export async function getBlueprintById(id: string): Promise<{ data?: BlueprintRecord; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { error: 'Unauthorized' }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('blueprints')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('[Blueprints] Fetch by ID error:', error)
    return { error: 'Blueprint not found' }
  }

  return { data: data as BlueprintRecord }
}

/**
 * Delete a blueprint (must belong to current user)
 * Uses admin client to bypass RLS (safe since we validate userId via Clerk)
 */
export async function deleteBlueprint(id: string): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Unauthorized' }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('blueprints')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('[Blueprints] Delete error:', error)
    return { success: false, error: 'Failed to delete blueprint' }
  }

  revalidatePath('/dashboard')
  return { success: true }
}
