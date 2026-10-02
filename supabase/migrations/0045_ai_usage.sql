-- 0045 — the AI usage ledger (lib/ai/usage.ts). Apply after 0044; it depends on nothing but auth.
--
-- WHAT IT IS FOR. Every AI act Zenboard performs is one row: who, which feature, which provider and
-- model, whether it produced something usable, and what it cost. It answers two questions the
-- gateway asks before every request:
--   · has this person had their fair share today? (a daily allowance — the AI plan's rule 8, "track
--     AI usage from day one", and why no plan will ever promise "unlimited")
--   · how much of Workers AI's free pool (10,000 Neurons a day, shared by EVERY account holder) is
--     gone? Past the guard, requests go to the fallback provider instead of spending money.
--
-- SECURITY.
--   · Rows are written ONLY by the service role, inside the server. There is no insert policy: if a
--     person could write their own rows they could forge a huge Neuron count and switch the shared
--     pool off for everyone, or delete rows to reset their allowance.
--   · The owner can READ their own rows (a future "your AI usage" view needs nothing more).
--   · The pool total is a function the service role alone may execute. It returns one number, never
--     a row, because the rows are other people's.
--
-- UNTIL THIS IS APPLIED everything still works: the gateway reads a failed query as "not tracked"
-- and neither limit applies. Idempotent: safe to run twice. Additive only.

create table if not exists ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (char_length(feature) between 1 and 64),
  provider text not null check (char_length(provider) between 1 and 32),
  model text not null check (char_length(model) between 1 and 128),
  ok boolean not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  neurons numeric(12, 3) not null default 0 check (neurons >= 0),
  created_at timestamptz not null default now()
);

-- The allowance reads one person's day; the guard reads everyone's since midnight UTC.
create index if not exists idx_ai_usage_user_created on ai_usage(user_id, created_at desc);
create index if not exists idx_ai_usage_provider_created on ai_usage(provider, created_at desc);

alter table ai_usage enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'ai_usage' and policyname = 'owner_sel') then
    create policy owner_sel on ai_usage for select using (user_id = auth.uid());
  end if;
end $$;

create or replace function ai_pool_neurons(since timestamptz)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(neurons), 0) from ai_usage where provider = 'workers-ai' and created_at >= since;
$$;

revoke all on function ai_pool_neurons(timestamptz) from public, anon, authenticated;
grant execute on function ai_pool_neurons(timestamptz) to service_role;
