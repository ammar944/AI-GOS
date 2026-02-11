'use server'

import { auth } from '@clerk/nextjs/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { OnboardingData } from '@/lib/supabase/types'

// Validation schema for onboarding data
const onboardingDataSchema = z.object({
  businessBasics: z.record(z.string(), z.any()).optional(),
  icpData: z.record(z.string(), z.any()).optional(),
  productOffer: z.record(z.string(), z.any()).optional(),
  marketCompetition: z.record(z.string(), z.any()).optional(),
  customerJourney: z.record(z.string(), z.any()).optional(),
  brandPositioning: z.record(z.string(), z.any()).optional(),
  assetsProof: z.record(z.string(), z.any()).optional(),
  budgetTargets: z.record(z.string(), z.any()).optional(),
  compliance: z.record(z.string(), z.any()).optional(),
  currentStep: z.number().int().min(0).max(8).optional(),
})

/**
 * Update user's onboarding data (partial update)
 * Uses admin client to bypass RLS (safe since we validate userId via Clerk)
 */
export async function updateOnboardingData(data: Partial<OnboardingData>) {
  // Check authentication via Clerk
  const { userId } = await auth()
  if (!userId) {
    return { error: 'Unauthorized' }
  }

  // Validate input
  const parsed = onboardingDataSchema.safeParse(data)
  if (!parsed.success) {
    return {
      error: 'Invalid onboarding data',
      details: parsed.error.flatten()
    }
  }

  // Use admin client to bypass RLS issues with Clerk JWT
  const supabase = createAdminClient()

  // Get current onboarding data
  const { data: profile, error: fetchError } = await supabase
    .from('user_profiles')
    .select('onboarding_data')
    .eq('id', userId)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('[Onboarding] Error fetching profile:', fetchError)
    return { error: 'Failed to fetch profile' }
  }

  // Merge with existing data
  const mergedData = {
    ...((profile?.onboarding_data as OnboardingData) || {}),
    ...parsed.data,
  }

  // Upsert onboarding data (create if doesn't exist, update if it does)
  const { data: updated, error: updateError } = await supabase
    .from('user_profiles')
    .upsert({
      id: userId,
      onboarding_data: mergedData,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single()

  if (updateError) {
    console.error('[Onboarding] Error updating data:', updateError)
    return { error: 'Failed to update onboarding data' }
  }

  revalidatePath('/onboarding')
  revalidatePath('/dashboard')
  revalidatePath('/generate')

  return { data: updated }
}

/**
 * Mark onboarding as completed
 * Uses admin client to bypass RLS (safe since we validate userId via Clerk)
 */
export async function completeOnboarding() {
  // Check authentication via Clerk
  const { userId } = await auth()
  if (!userId) {
    return { error: 'Unauthorized' }
  }

  // Use admin client to bypass RLS issues with Clerk JWT
  const supabase = createAdminClient()

  // Upsert completion status (create if doesn't exist)
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({
      id: userId,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single()

  if (error) {
    console.error('[Onboarding] Error completing onboarding:', error)
    return { error: 'Failed to complete onboarding' }
  }

  revalidatePath('/onboarding')
  revalidatePath('/dashboard')
  revalidatePath('/generate')

  return { data }
}

/**
 * Get user's onboarding status and data
 * Uses admin client to bypass RLS (safe since we validate userId via Clerk)
 */
export async function getOnboardingStatus() {
  // Check authentication via Clerk
  const { userId } = await auth()
  if (!userId) {
    return { error: 'Unauthorized' }
  }

  // Use admin client to bypass RLS issues with Clerk JWT
  // This is safe because we already validated the user via Clerk auth
  const supabase = createAdminClient()

  // Fetch onboarding status
  const { data, error } = await supabase
    .from('user_profiles')
    .select('onboarding_completed, onboarding_completed_at, onboarding_data')
    .eq('id', userId)
    .single()

  if (error) {
    // PGRST116 means no rows found - user profile doesn't exist yet
    if (error.code === 'PGRST116') {
      return {
        data: {
          completed: false,
          completedAt: null,
          onboardingData: null,
        }
      }
    }
    console.error('[Onboarding] Error fetching status:', error)
    return { error: 'Failed to fetch onboarding status' }
  }

  return {
    data: {
      completed: data.onboarding_completed,
      completedAt: data.onboarding_completed_at,
      onboardingData: data.onboarding_data as OnboardingData | null,
    }
  }
}

/**
 * Reset onboarding (for testing or allowing users to redo)
 * Uses admin client to bypass RLS (safe since we validate userId via Clerk)
 */
export async function resetOnboarding() {
  // Check authentication via Clerk
  const { userId } = await auth()
  if (!userId) {
    return { error: 'Unauthorized' }
  }

  // Use admin client to bypass RLS issues with Clerk JWT
  const supabase = createAdminClient()

  // Reset onboarding status
  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      onboarding_completed: false,
      onboarding_completed_at: null,
      onboarding_data: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    console.error('[Onboarding] Error resetting onboarding:', error)
    return { error: 'Failed to reset onboarding' }
  }

  revalidatePath('/onboarding')
  revalidatePath('/dashboard')
  revalidatePath('/generate')

  return { data }
}
