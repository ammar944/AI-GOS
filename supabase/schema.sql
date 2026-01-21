-- AI-GOS Database Schema
-- Run this in your Supabase SQL Editor
-- Note: Authentication is handled by Clerk, not Supabase Auth

-- Projects table
-- user_id is a text field to store Clerk user IDs
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text,
  form_data jsonb,
  status text default 'draft',
  created_at timestamp with time zone default now()
);

-- Reports table
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  type text,
  content jsonb,
  pdf_url text,
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.projects enable row level security;
alter table public.reports enable row level security;

-- Temporary permissive policies
-- TODO: Update these with Clerk-based authentication policies
-- when Clerk integration is complete
create policy "Allow all access to projects"
on public.projects for all
using (true)
with check (true);

create policy "Allow all access to reports"
on public.reports for all
using (true)
with check (true);
