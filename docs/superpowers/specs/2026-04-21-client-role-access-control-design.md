# Client Role Access Control — Design Spec

**Date:** 2026-04-21
**Status:** Ready for implementation
**Source:** Impromptu Google Meet meeting on 2026-04-20

## Overview

Add a role-based access control layer for external client rollout. The app already uses Clerk for authentication and Supabase for data ownership. This feature adds app-level roles and allowlisting on top of the existing owner-scoped model so the team can safely invite clients, constrain what clients can do, and let internal users review client work without breaking the current tenancy model.

This is not a generic enterprise permissions system. It is a narrow rollout system for three roles discussed in the meeting:

- `admin`
- `internal`
- `client`

## Source Requirements From The Meeting

The role model came from the following requirements in the call:

1. Around `1:08:21`, Gilles proposed three roles:
  - `admin`: full access to everything
  - `internal`: access all client profiles and impersonate a profile to make changes or review it
  - `client`: access only their own profile; no ability to create another profile or run another search after the initial setup
2. Around `1:09:49`, Gilles described the rollout flow:
  - give clients a signup link
  - let them sign up
  - approve or allowlist them
  - assign them the `client` role
  - let them use the app in a constrained mode for feedback

## Product Goal

Ship a `v1` access model that supports controlled client feedback without changing the core `journey_sessions` and `business_profiles` ownership model.

## Non-Goals

- Multi-seat client organizations
- Fine-grained per-feature ACLs
- Billing or subscription plans
- Real Clerk user impersonation
- Cross-company collaboration
- Per-profile sharing permissions beyond the existing public share-token flow

## Key Decision

Use Clerk for identity, but store app roles and allowlist state in the app database. Do not implement this as a Vercel whitelist. The whitelist is product authorization state, not deployment security state.

## Existing Architecture Constraints

The current app already has these constraints:

- Clerk is the source of authenticated identity.
- `user_profiles.id` stores the Clerk user ID.
- `business_profiles.user_id` and `journey_sessions.user_id` are the core ownership boundaries.
- Most API routes authorize using `auth().userId`.
- Some server helpers use the Supabase admin client, so database RLS alone is not enough for role enforcement.

This feature must layer authorization checks on top of that existing model. It should not replace the current ownership model.

## Assumptions For V1

1. One client account maps to one company profile in `v1`.
2. A client can complete one initial journey and then continue refining existing data, but cannot start another fresh company setup.
3. `internal` users can review and edit client data through app-level impersonation.
4. Only `admin` users can manage the allowlist and assign roles in `v1`.
5. Client access is invite-only.

## Role Definitions

### `admin`

Full platform access. Can manage roles, allowlist entries, and all client records.

### `internal`

Operational team member. Can see all client accounts and profiles, and can impersonate a client context to review or edit that client’s workspace. Cannot manage allowlist entries or role assignment in `v1`.

### `client`

External user. Can only access their own account data. Can complete the initial setup once, then continue refining their existing profile and outputs. Cannot create another company profile and cannot start a second fresh journey.

## Permission Matrix


| Capability                           | Admin | Internal | Client        |
| ------------------------------------ | ----- | -------- | ------------- |
| Sign in if approved                  | Yes   | Yes      | Yes           |
| Manage allowlist                     | Yes   | No       | No            |
| Assign or change app roles           | Yes   | No       | No            |
| View all client profiles             | Yes   | Yes      | No            |
| View own profile only                | Yes   | Yes      | Yes           |
| Impersonate client profile           | Yes   | Yes      | No            |
| Create first journey/profile         | Yes   | Yes      | Yes           |
| Create additional profiles           | Yes   | Yes      | No            |
| Start additional fresh research runs | Yes   | Yes      | No            |
| Edit existing profile/workspace      | Yes   | Yes      | Yes, own only |
| Access internal dashboards/lists     | Yes   | Yes      | No            |


## User Model Changes

### Extend `user_profiles`

Add the following columns to `user_profiles`:

```sql
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS app_role text,
ADD COLUMN IF NOT EXISTS account_status text,
ADD COLUMN IF NOT EXISTS primary_profile_id uuid REFERENCES public.business_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS client_locked_at timestamptz,
ADD COLUMN IF NOT EXISTS role_assigned_at timestamptz,
ADD COLUMN IF NOT EXISTS role_assigned_by text;
```

### Allowed values

```ts
type AppRole = 'admin' | 'internal' | 'client';
type AccountStatus = 'pending' | 'active' | 'disabled';
```

### Meaning

- `app_role`: the user’s application role
- `account_status`: whether the user can access the app
- `primary_profile_id`: the single company profile a client is locked to in `v1`
- `client_locked_at`: timestamp set once the client has completed the initial setup and should no longer be allowed to create a fresh journey
- `role_assigned_at` / `role_assigned_by`: auditability for role changes

## Allowlist Model

Create a new table for invite-only access.

```sql
CREATE TABLE IF NOT EXISTS public.client_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  intended_role text NOT NULL CHECK (intended_role IN ('admin', 'internal', 'client')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revoked')),
  claimed_user_id text,
  claimed_at timestamptz,
  notes text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### Purpose

- controls who is allowed into the product
- defines the intended role before first login
- gives the team a clean approval path for external client feedback

## Access Resolution Flow

### First login

1. User signs up or signs in through Clerk.
2. App fetches the signed-in user email.
3. App checks `client_allowlist` for that email.
4. If there is no approved entry:
  - create or update `user_profiles.account_status = 'pending'`
  - show an access-pending screen
5. If there is an approved entry:
  - stamp `user_profiles.app_role`
  - set `account_status = 'active'`
  - set `role_assigned_at`
  - set `claimed_user_id` and `claimed_at` on the allowlist row if empty

### Subsequent login

1. Read `user_profiles.app_role` and `account_status`.
2. If `disabled`, block access.
3. If `active`, continue with route-level authorization.

## Client Journey Locking

### Desired behavior

A client should be able to do the first setup, but after that they should be constrained to their own existing workspace and refinement flow.

### Lock rule

Set `primary_profile_id` and `client_locked_at` when all of the following are true:

1. the user has role `client`
2. the user completes their first successful business profile save
3. a profile exists to bind them to

### After lock

Client users:

- can open their existing profile
- can open their existing research sessions
- can refine/edit the current workspace
- cannot create a second profile
- cannot start a new greenfield journey

## Impersonation Model

### Decision

Use app-level impersonation, not Clerk impersonation, in `v1`.

### Why

- simpler to implement
- avoids auth/session complexity
- keeps a clear audit trail between the acting user and the effective client context

### Behavior

1. `admin` or `internal` selects a client profile from an internal view.
2. App stores an impersonation target server-side, scoped to the current session.
3. Server APIs resolve both:
  - `actorUserId`: the signed-in internal/admin user
  - `effectiveProfileId` / `effectiveUserId`: the client context being viewed
4. UI shows a persistent banner:
  - `Viewing as <Client Name>`
5. All writes in impersonation mode record the actor separately from the effective target.

### Audit requirement

Every impersonated write should log:

```ts
interface AccessAuditLog {
  id: string;
  actorUserId: string;
  effectiveUserId: string | null;
  effectiveProfileId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: string;
}
```

`v1` can store this in a lightweight `access_audit_logs` table or write structured server logs if a table is too much for the first pass. A table is preferred.

## Route Behavior

### Shared rule

Every protected route should resolve:

1. authenticated Clerk user
2. `user_profiles.app_role`
3. `user_profiles.account_status`
4. optional impersonation context

### Client-facing behavior

#### `/journey`

- `admin`: full access
- `internal`: full access
- `client` before lock: allowed
- `client` after lock: redirect to existing profile or latest research page

#### `/profiles`

- `admin`: list all or internal overview entrypoint
- `internal`: list all client profiles
- `client`: do not show the general index; redirect to `/profiles/{primaryProfileId}`

#### `/profiles/[id]`

- `admin`: allowed
- `internal`: allowed
- `client`: allowed only if `[id] === primary_profile_id`

#### `/research`

- `admin`: allowed
- `internal`: allowed
- `client`: do not show the general list; redirect to their own latest research session or profile

#### `/research/[sessionId]`

- `admin`: allowed
- `internal`: allowed
- `client`: allowed only for sessions belonging to their own profile/account

#### `/dashboard`

- `admin`: full dashboard
- `internal`: full internal dashboard
- `client`: reduced dashboard or direct redirect to their own profile/workspace

Recommended `v1`: redirect clients away from the general command center and into their bound profile/workspace.

## API Authorization Rules

Add a shared authorization helper so routes do not each reinvent the role logic.

### New helper

Create a server-only helper similar to:

```ts
interface AuthorizedAppUser {
  actorUserId: string;
  role: 'admin' | 'internal' | 'client';
  accountStatus: 'pending' | 'active' | 'disabled';
  effectiveUserId: string;
  effectiveProfileId: string | null;
  primaryProfileId: string | null;
  clientLockedAt: string | null;
}
```

Suggested file:

- `src/lib/auth/app-access.ts`

### Helper responsibilities

1. resolve Clerk user
2. fetch `user_profiles`
3. enforce `account_status`
4. resolve impersonation context if present
5. expose small guard helpers:
  - `requireAdmin()`
  - `requireInternalOrAdmin()`
  - `requireOwnProfileAccess(profileId)`
  - `requireJourneyCreationAllowed()`

## API Changes

### Existing routes that need role checks

- `src/app/api/profiles/route.ts`
- `src/app/api/profiles/[id]/route.ts`
- `src/app/api/profiles/[id]/sessions/route.ts`
- `src/app/api/journey/session/route.ts`
- `src/app/api/journey/stream/route.ts`
- `src/app/api/journey/dispatch/route.ts`
- `src/app/api/share/route.ts`

### Key behavior changes

#### `POST /api/profiles`

- allow `client` only if they do not already have a locked `primary_profile_id`
- after first successful save for a client:
  - set `primary_profile_id`
  - set `client_locked_at`

#### `GET /api/profiles`

- `admin` / `internal`: return all client profiles or filtered internal list
- `client`: either reject or return only the bound profile

Recommended `v1`: return only the bound profile for `client`.

#### `GET/PATCH /api/profiles/:id`

- `client` can only read or patch their bound profile
- `internal` / `admin` can patch through impersonation or direct access

#### Journey creation / reset endpoints

Any endpoint that creates a new run or clears to a fresh run must reject locked clients with a clear error:

```json
{
  "error": "Client accounts can refine an existing workspace but cannot start a new journey."
}
```

## UI Changes

### Internal/Admin UI

Add a lightweight client management surface:

- list approved clients
- search by company or email
- open profile
- enter impersonation mode

This can live under a new internal page or be folded into the existing profiles page in `v1`.

### Client UI

Client navigation should be reduced:

- remove global multi-profile browsing
- remove generic “new research” CTA after lock
- keep access to:
  - their profile
  - their research output
  - editing/refinement actions

### Impersonation banner

Show a clear persistent banner in the shell:

- `Viewing as Acme Inc`
- `Exit impersonation`

## Data Ownership Rules

The existing ownership model remains the source of truth:

- `journey_sessions.user_id`
- `business_profiles.user_id`

For `v1`, do not rewrite rows to the internal user during impersonation. Internal/admin users act on behalf of the client context, but the client remains the owner of the underlying records.

## Migration Plan

### Migration 1

Add role and account-status columns to `user_profiles`.

### Migration 2

Create `client_allowlist`.

### Migration 3

Optional but recommended: create `access_audit_logs`.

## Files To Create


| File                                                                 | Purpose                               |
| -------------------------------------------------------------------- | ------------------------------------- |
| `src/lib/auth/app-access.ts`                                         | Shared app-level authorization helper |
| `src/lib/auth/impersonation.ts`                                      | Read/write impersonation context      |
| `src/app/api/admin/allowlist/route.ts`                               | Admin allowlist CRUD                  |
| `src/app/api/admin/impersonation/route.ts`                           | Start/stop impersonation              |
| `src/components/shell/impersonation-banner.tsx`                      | Persistent UI banner                  |
| `supabase/migrations/<timestamp>_add_app_roles_to_user_profiles.sql` | Role/account columns                  |
| `supabase/migrations/<timestamp>_create_client_allowlist.sql`        | Invite-only access table              |


## Files To Modify


| File                                    | Purpose                                                 |
| --------------------------------------- | ------------------------------------------------------- |
| `src/middleware.ts`                     | Route-level redirect logic for client-mode paths        |
| `src/app/layout.tsx`                    | Provide impersonation/banner context if needed          |
| `src/app/dashboard/page.tsx`            | Client redirect or reduced dashboard                    |
| `src/app/profiles/page.tsx`             | Internal/admin list behavior; client redirect           |
| `src/app/profiles/[id]/page.tsx`        | Enforce own-profile view for clients                    |
| `src/app/journey/page.tsx`              | Block fresh journeys for locked clients                 |
| `src/app/api/profiles/route.ts`         | Enforce first-profile-only client behavior              |
| `src/app/api/profiles/[id]/route.ts`    | Role-aware read/write checks                            |
| `src/lib/profiles/business-profiles.ts` | Respect app-level authorization in admin-client helpers |


## Implementation Order

1. Add Supabase schema changes for role data and allowlist.
2. Add shared app-access helper that resolves role, status, and impersonation.
3. Protect existing API routes with the new helper.
4. Add client lock behavior on first profile creation.
5. Add client-mode redirects for dashboard, profiles, research, and journey.
6. Add internal/admin impersonation flow and banner.
7. Add admin allowlist management endpoints and minimal UI.
8. Add tests.

## Testing

### Unit tests

- `app-access` resolves the correct role/state combinations
- locked clients are rejected from fresh-journey creation
- clients cannot read another profile ID
- internal/admin impersonation resolves effective target correctly

### Route tests

- unauthorized user gets `401`
- pending or disabled user is blocked
- client can patch own bound profile
- client cannot patch another profile
- client cannot create a second profile
- internal/admin can access client profile through impersonation

### UI tests

- client is redirected away from general `/profiles`
- client sees only their bound workspace
- impersonation banner appears for internal/admin sessions

## Edge Cases

1. Client signs up before being approved
  - result: `pending` screen
2. Client is approved after signup
  - next load activates account
3. Client has no `primary_profile_id` yet
  - allow initial journey
4. Internal user enters impersonation mode and refreshes
  - impersonation should persist for that session until explicitly exited
5. Admin revokes a client
  - next request should block access with `account_status = 'disabled'`

## Risks

1. Because some helpers use the admin Supabase client, UI-only role gating is insufficient.
2. If impersonation is implemented only in the browser, it will be trivial to bypass.
3. If client locking happens too early, the user may get stuck before a usable profile exists.

## Recommended Defaults

For unresolved product decisions, use these defaults in `v1`:

1. Only `admin` can manage allowlist and roles.
2. `internal` can impersonate but not manage role assignment.
3. Locked clients redirect to their bound profile page, not the dashboard.
4. Clients can continue editing/refining their existing workspace, but cannot start a new greenfield run.

## Cursor Execution Notes

When implementing this spec:

1. Do not replace the current ownership model in `journey_sessions` or `business_profiles`.
2. Add app-level authorization on top of existing ownership checks.
3. Centralize role logic in one shared helper before modifying routes.
4. Keep `v1` narrow: invite-only, one client account to one profile, app-level impersonation.
5. Avoid Clerk organization features unless absolutely necessary; they are out of scope for this rollout.

