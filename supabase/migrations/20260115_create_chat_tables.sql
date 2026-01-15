-- Chat History Persistence Schema
-- Migration: 20260115_create_chat_tables.sql

-- Conversations table
-- Stores chat sessions, optionally linked to a blueprint
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid,
  user_id uuid references auth.users(id) on delete cascade,
  title text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Chat messages table
-- Stores individual messages with metadata for RAG responses
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  confidence text check (confidence in ('high', 'medium', 'low')),
  confidence_explanation text,
  intent text,
  sources jsonb,
  source_quality jsonb,
  pending_edits jsonb,
  created_at timestamp with time zone default now(),
  tokens_used integer,
  cost numeric(10, 6)
);

-- Indexes for efficient queries
create index if not exists idx_chat_messages_conversation on public.chat_messages(conversation_id);
create index if not exists idx_chat_messages_created on public.chat_messages(created_at);
create index if not exists idx_conversations_blueprint on public.conversations(blueprint_id);
create index if not exists idx_conversations_user on public.conversations(user_id);
create index if not exists idx_conversations_updated on public.conversations(updated_at desc);

-- Enable Row Level Security
alter table public.conversations enable row level security;
alter table public.chat_messages enable row level security;

-- RLS Policies for conversations table
create policy "Users can view own conversations"
on public.conversations for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert own conversations"
on public.conversations for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update own conversations"
on public.conversations for update
to authenticated
using (user_id = auth.uid());

create policy "Users can delete own conversations"
on public.conversations for delete
to authenticated
using (user_id = auth.uid());

-- RLS Policies for chat_messages table
-- Messages access is controlled through conversation ownership
create policy "Users can view messages in own conversations"
on public.chat_messages for select
to authenticated
using (
  exists (
    select 1 from public.conversations
    where conversations.id = chat_messages.conversation_id
    and conversations.user_id = auth.uid()
  )
);

create policy "Users can insert messages in own conversations"
on public.chat_messages for insert
to authenticated
with check (
  exists (
    select 1 from public.conversations
    where conversations.id = chat_messages.conversation_id
    and conversations.user_id = auth.uid()
  )
);

create policy "Users can update messages in own conversations"
on public.chat_messages for update
to authenticated
using (
  exists (
    select 1 from public.conversations
    where conversations.id = chat_messages.conversation_id
    and conversations.user_id = auth.uid()
  )
);

create policy "Users can delete messages in own conversations"
on public.chat_messages for delete
to authenticated
using (
  exists (
    select 1 from public.conversations
    where conversations.id = chat_messages.conversation_id
    and conversations.user_id = auth.uid()
  )
);

-- Trigger to update conversations.updated_at when messages are added
create or replace function public.update_conversation_timestamp()
returns trigger as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_chat_message_created on public.chat_messages;
create trigger on_chat_message_created
  after insert on public.chat_messages
  for each row execute function public.update_conversation_timestamp();
