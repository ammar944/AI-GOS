# Onboarding Schema Implementation

## Overview
This document describes the database schema changes and implementation for tracking user onboarding completion status in the AI-GOS application.

## Database Changes

### New Columns in `user_profiles` Table

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `onboarding_completed` | `boolean` | NO | `false` | Indicates if user completed the 9-step onboarding |
| `onboarding_completed_at` | `timestamptz` | YES | `NULL` | Timestamp when onboarding was completed |
| `onboarding_data` | `jsonb` | YES | `NULL` | Stores the 9-step onboarding form data |

### Indexes

1. **idx_user_profiles_onboarding_completed**
   - Column: `onboarding_completed`
   - Purpose: Fast queries to find users by onboarding status

2. **idx_user_profiles_onboarding_completed_at**
   - Column: `onboarding_completed_at DESC`
   - Condition: `WHERE onboarding_completed_at IS NOT NULL`
   - Purpose: Efficiently query users who completed onboarding, sorted by completion date

### Constraints

**check_onboarding_completed_at_when_completed**
- Ensures data integrity between `onboarding_completed` and `onboarding_completed_at`
- Rules:
  - If `onboarding_completed = false`, then `onboarding_completed_at` must be `NULL`
  - If `onboarding_completed = true`, `onboarding_completed_at` can be any value (ideally set)

## Row Level Security (RLS)

### Policies

1. **Users can view their own profile**
   - Operation: `SELECT`
   - Rule: `id = auth.jwt() ->> 'sub'`
   - Users can only read their own profile data

2. **Users can update their own profile**
   - Operation: `UPDATE`
   - Rule: `id = auth.jwt() ->> 'sub'`
   - Users can only update their own profile, including onboarding fields

3. **Users can insert their own profile**
   - Operation: `INSERT`
   - Rule: `id = auth.jwt() ->> 'sub'`
   - Allows profile creation if not done via Clerk webhook

### Important Notes

- **Service Role Bypass**: The Clerk webhook uses the service role which bypasses RLS automatically
- **Clerk JWT**: The RLS policies use `auth.jwt() ->> 'sub'` to extract the Clerk user ID from the JWT
- **Security**: Users cannot access or modify other users' profiles

## Onboarding Data Structure

The `onboarding_data` JSONB field stores data from the 9-step onboarding process:

```typescript
interface OnboardingData {
  businessBasics?: Record<string, Json>;
  icpData?: Record<string, Json>;
  productOffer?: Record<string, Json>;
  marketCompetition?: Record<string, Json>;
  customerJourney?: Record<string, Json>;
  brandPositioning?: Record<string, Json>;
  assetsProof?: Record<string, Json>;
  budgetTargets?: Record<string, Json>;
  compliance?: Record<string, Json>;
}
```

Each step stores its form data as a nested object within the JSONB field.

## Server Actions

### Available Actions

Located in `/src/lib/actions/onboarding.ts`:

1. **updateOnboardingData(data: Partial<OnboardingData>)**
   - Updates onboarding data (partial merge with existing data)
   - Validates input with Zod
   - Returns: `{ data: UserProfile } | { error: string }`

2. **completeOnboarding()**
   - Marks onboarding as completed
   - Sets `onboarding_completed = true` and `onboarding_completed_at = now()`
   - Returns: `{ data: UserProfile } | { error: string }`

3. **getOnboardingStatus()**
   - Retrieves user's onboarding status and data
   - Returns: `{ data: { completed, completedAt, onboardingData } } | { error: string }`

4. **resetOnboarding()**
   - Resets onboarding status (for testing or allowing redo)
   - Clears all onboarding fields
   - Returns: `{ data: UserProfile } | { error: string }`

### Usage Example

```typescript
'use client'

import { updateOnboardingData, completeOnboarding } from '@/lib/actions/onboarding'
import { useRouter } from 'next/navigation'

export function OnboardingForm() {
  const router = useRouter()

  const handleStepComplete = async (stepName: string, stepData: any) => {
    const result = await updateOnboardingData({
      [stepName]: stepData
    })

    if (result.error) {
      console.error('Failed to save:', result.error)
    }
  }

  const handleComplete = async () => {
    const result = await completeOnboarding()

    if (result.error) {
      console.error('Failed to complete:', result.error)
      return
    }

    router.push('/dashboard')
  }

  // ... rest of component
}
```

## Migration Instructions

### 1. Apply the Migration

```bash
# If using Supabase CLI
supabase db push

# Or manually run the SQL file in Supabase Dashboard
# File: supabase/migrations/20260122_add_onboarding_fields.sql
```

### 2. Update TypeScript Types

The types are already updated in `/src/lib/supabase/types.ts`:
- `OnboardingData` interface
- `user_profiles` table type definitions

### 3. Test RLS Policies

```sql
-- Test as authenticated user
SET request.jwt.claims = '{"sub": "user_clerk_id"}';

-- Should work: Select own profile
SELECT * FROM user_profiles WHERE id = 'user_clerk_id';

-- Should work: Update own profile
UPDATE user_profiles
SET onboarding_data = '{"businessBasics": {"name": "Test"}}'::jsonb
WHERE id = 'user_clerk_id';

-- Should fail: Select other user's profile
SELECT * FROM user_profiles WHERE id = 'other_user_clerk_id';
```

## Best Practices

1. **Always validate input** - Use Zod schemas in server actions
2. **Partial updates** - Merge new onboarding data with existing data
3. **Set completed_at** - Always set `onboarding_completed_at` when marking complete
4. **Revalidate paths** - Clear Next.js cache after updates
5. **Error handling** - Log errors server-side, return user-friendly messages
6. **Type safety** - Use the exported `OnboardingData` type consistently

## Future Considerations

1. **Versioning**: Consider adding `onboarding_version` to track schema changes
2. **Analytics**: Query `onboarding_completed_at` for completion metrics
3. **Partial completion**: Track which steps are completed using a separate field
4. **Validation**: Add more specific Zod schemas for each onboarding step
5. **Audit log**: Consider logging onboarding data changes for compliance

## Rollback

If needed, you can rollback the migration:

```sql
-- Remove columns
ALTER TABLE public.user_profiles
DROP COLUMN IF EXISTS onboarding_completed,
DROP COLUMN IF EXISTS onboarding_completed_at,
DROP COLUMN IF EXISTS onboarding_data;

-- Drop indexes
DROP INDEX IF EXISTS idx_user_profiles_onboarding_completed;
DROP INDEX IF EXISTS idx_user_profiles_onboarding_completed_at;

-- Drop constraint
ALTER TABLE public.user_profiles
DROP CONSTRAINT IF EXISTS check_onboarding_completed_at_when_completed;
```

## Related Files

- Migration: `/supabase/migrations/20260122_add_onboarding_fields.sql`
- Types: `/src/lib/supabase/types.ts`
- Actions: `/src/lib/actions/onboarding.ts`
- Webhook: `/src/app/api/webhooks/clerk/route.ts`
