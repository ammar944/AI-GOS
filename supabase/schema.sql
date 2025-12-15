-- AI-GOS Database Schema
-- Run this in your Supabase SQL Editor

-- Users table (extends auth.users)
create table if not exists public.users (
  id uuid references auth.users on delete cascade primary key,
  email text,
  name text,
  created_at timestamp with time zone default now()
);

-- Projects table
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
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
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.reports enable row level security;

-- RLS Policies for users table
create policy "Users can view own profile" on public.users
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- RLS Policies for projects table
create policy "Users can view own projects" on public.projects
  for select using (auth.uid() = user_id);

create policy "Users can insert own projects" on public.projects
  for insert with check (auth.uid() = user_id);

create policy "Users can update own projects" on public.projects
  for update using (auth.uid() = user_id);

create policy "Users can delete own projects" on public.projects
  for delete using (auth.uid() = user_id);

-- RLS Policies for reports table
create policy "Users can view own reports" on public.reports
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = reports.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can insert own reports" on public.reports
  for insert with check (
    exists (
      select 1 from public.projects
      where projects.id = reports.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can update own reports" on public.reports
  for update using (
    exists (
      select 1 from public.projects
      where projects.id = reports.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can delete own reports" on public.reports
  for delete using (
    exists (
      select 1 from public.projects
      where projects.id = reports.project_id
      and projects.user_id = auth.uid()
    )
  );

-- Function to auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on auth signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
