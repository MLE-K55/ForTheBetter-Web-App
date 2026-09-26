create table if not exists public.journal_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  theme text not null default 'light' check (theme in ('light', 'dark', 'pastel', 'hacker')),
  journey_started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  page_id text not null,
  answers jsonb not null default '{}'::jsonb,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, page_id)
);

alter table public.journal_profiles enable row level security;
alter table public.journal_entries enable row level security;

create policy "Users can read their own profile" on public.journal_profiles for select using (auth.uid() = user_id);
create policy "Users can insert their own profile" on public.journal_profiles for insert with check (auth.uid() = user_id);
create policy "Users can update their own profile" on public.journal_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can read their own entries" on public.journal_entries for select using (auth.uid() = user_id);
create policy "Users can insert their own entries" on public.journal_entries for insert with check (auth.uid() = user_id);
create policy "Users can update their own entries" on public.journal_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own entries" on public.journal_entries for delete using (auth.uid() = user_id);

create index if not exists journal_entries_user_id_idx on public.journal_entries(user_id);
