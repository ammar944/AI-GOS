'use client'

import { useEffect, useState } from 'react'
import { getOnboardingStatus } from '@/lib/actions/onboarding'
import type { OnboardingData } from '@/lib/supabase/types'

interface OnboardingStatus {
  completed: boolean
  completedAt: string | null
  onboardingData: OnboardingData | null
}

interface UseOnboardingReturn {
  status: OnboardingStatus | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Client-side hook to fetch and track user's onboarding status
 *
 * @example
 * ```tsx
 * function OnboardingGuard({ children }) {
 *   const { status, isLoading } = useOnboarding()
 *
 *   if (isLoading) return <Loader />
 *   if (!status?.completed) return <Redirect to="/onboarding" />
 *
 *   return children
 * }
 * ```
 */
export function useOnboarding(): UseOnboardingReturn {
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await getOnboardingStatus()

      if (result.error) {
        setError(result.error)
        setStatus(null)
      } else if (result.data) {
        setStatus(result.data)
      }
    } catch (err) {
      setError('Failed to fetch onboarding status')
      console.error('[useOnboarding] Error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  return {
    status,
    isLoading,
    error,
    refetch: fetchStatus,
  }
}
