# AI-GOS Database Structure

## Overview

AI-GOS uses **Supabase (PostgreSQL)** with Row Level Security (RLS) enabled on all tables. The database is designed to support a multi-tenant architecture where users can only access their own data.

## Tables

### 1. `public.users`

Extends Supabase's built-in `auth.users` table to store additional user profile information.

| Column       | Type                     | Constraints                    | Description                  |
|--------------|--------------------------|--------------------------------|------------------------------|
| `id`         | `uuid`                   | PRIMARY KEY, FK to auth.users  | User's unique identifier     |
| `email`      | `text`                   |                                | User's email address         |
| `name`       | `text`                   |                                | User's display name          |
| `created_at` | `timestamp with time zone` | DEFAULT now()                | Account creation timestamp   |

**RLS Policies:**
- `SELECT`: Users can only view their own profile
- `UPDATE`: Users can only update their own profile

**Trigger:** `on_auth_user_created` - Automatically creates a user profile when a new auth user signs up.

---

### 2. `public.projects`

Stores research projects created by users.

| Column       | Type                     | Constraints                    | Description                        |
|--------------|--------------------------|--------------------------------|------------------------------------|
| `id`         | `uuid`                   | PRIMARY KEY, DEFAULT gen_random_uuid() | Project's unique identifier |
| `user_id`    | `uuid`                   | FK to users, ON DELETE CASCADE | Owner of the project               |
| `name`       | `text`                   | NOT NULL                       | Project name                       |
| `form_data`  | `jsonb`                  |                                | Flexible form data for research parameters |
| `status`     | `text`                   | DEFAULT 'draft'                | Project status (draft, active, completed) |
| `created_at` | `timestamp with time zone` | DEFAULT now()                | Project creation timestamp         |

**RLS Policies:**
- `SELECT`: Users can only view their own projects
- `INSERT`: Users can only create projects for themselves
- `UPDATE`: Users can only update their own projects
- `DELETE`: Users can only delete their own projects

---

### 3. `public.reports`

Stores generated research reports linked to projects.

| Column       | Type                     | Constraints                    | Description                        |
|--------------|--------------------------|--------------------------------|------------------------------------|
| `id`         | `uuid`                   | PRIMARY KEY, DEFAULT gen_random_uuid() | Report's unique identifier  |
| `project_id` | `uuid`                   | FK to projects, ON DELETE CASCADE | Parent project                 |
| `type`       | `text`                   | NOT NULL                       | Report type/category               |
| `content`    | `jsonb`                  |                                | Report content (flexible JSON structure) |
| `pdf_url`    | `text`                   |                                | URL to generated PDF file          |
| `created_at` | `timestamp with time zone` | DEFAULT now()                | Report creation timestamp          |

**RLS Policies:**
- `SELECT`: Users can only view reports from their own projects
- `INSERT`: Users can only create reports for their own projects
- `UPDATE`: Users can only update reports from their own projects
- `DELETE`: Users can only delete reports from their own projects

---

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   auth.users    │       │  public.users   │       │    projects     │
│   (Supabase)    │       │                 │       │                 │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │──────>│ id (PK, FK)     │<──────│ user_id (FK)    │
│ email           │       │ email           │       │ id (PK)         │
│ ...             │       │ name            │       │ name            │
└─────────────────┘       │ created_at      │       │ form_data       │
                          └─────────────────┘       │ status          │
                                                    │ created_at      │
                                                    └────────┬────────┘
                                                             │
                                                             │ 1:N
                                                             ▼
                                                    ┌─────────────────┐
                                                    │     reports     │
                                                    ├─────────────────┤
                                                    │ id (PK)         │
                                                    │ project_id (FK) │
                                                    │ type            │
                                                    │ content         │
                                                    │ pdf_url         │
                                                    │ created_at      │
                                                    └─────────────────┘
```

## Relationships

| Parent Table | Child Table | Relationship | On Delete  |
|--------------|-------------|--------------|------------|
| auth.users   | users       | 1:1          | CASCADE    |
| users        | projects    | 1:N          | CASCADE    |
| projects     | reports     | 1:N          | CASCADE    |

## Security

- **Row Level Security (RLS)** is enabled on all tables
- All policies enforce user isolation - users can only access their own data
- Cascade deletes ensure data integrity when parent records are removed

## Future Considerations

As the app grows, consider adding:

- `templates` table - For storing reusable project templates
- `team_members` table - For collaboration features
- `subscriptions` table - For billing/plan management
- `audit_logs` table - For tracking user actions
