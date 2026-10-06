-- Apply once in the Supabase SQL editor. No journal data is changed.
create table if not exists public.email_reminder_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  delivery_time text not null default '07:00' check (delivery_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  time_zone text not null default 'America/Chicago',
  next_send_at timestamptz,
  last_sent_date date,
  last_test_at timestamptz,
  lease_until timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.email_reminder_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  login_token text,
  status text not null default 'pending' check (status in ('pending','sent')),
  sent_at timestamptz,
  primary key (user_id, local_date)
);
alter table public.email_reminder_preferences enable row level security;
alter table public.email_reminder_deliveries enable row level security;
-- Only authenticated server endpoints write these tables. Login tokens are
-- never accessible using the browser's public key or another user's session.
revoke all on public.email_reminder_preferences from anon, authenticated;
revoke all on public.email_reminder_deliveries from anon, authenticated;
grant all on public.email_reminder_preferences, public.email_reminder_deliveries to service_role;
create index if not exists email_reminders_due on public.email_reminder_preferences(next_send_at) where enabled;

create or replace function public.claim_email_reminders(batch_size integer default 20)
returns setof public.email_reminder_preferences
language sql security definer set search_path = public
as $$
  with due as (
    select user_id from public.email_reminder_preferences
    where enabled and next_send_at <= now()
      and (lease_until is null or lease_until < now())
    order by next_send_at
    limit least(greatest(batch_size, 1), 20)
    for update skip locked
  )
  update public.email_reminder_preferences p
  set lease_until = now() + interval '5 minutes'
  from due where p.user_id = due.user_id
  returning p.*;
$$;
revoke all on function public.claim_email_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_email_reminders(integer) to service_role;

create or replace function public.claim_reminder_test(target_user uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  insert into public.email_reminder_preferences(user_id) values(target_user) on conflict do nothing;
  update public.email_reminder_preferences set last_test_at = now()
  where user_id = target_user and (last_test_at is null or last_test_at < now() - interval '10 minutes');
  return found;
end;
$$;
revoke all on function public.claim_reminder_test(uuid) from public, anon, authenticated;
grant execute on function public.claim_reminder_test(uuid) to service_role;
