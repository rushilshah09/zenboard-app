-- Form Builder — F1 core loop (FORM_BUILDER_MASTER_PLAN.md §4, §14).
--
-- A form belongs to exactly ONE home: a client or a project (templates have
-- neither). Respondents are anonymous capability-holders of share_token — there
-- is deliberately NO anon insert policy anywhere here: every public write goes
-- through a token-validated service-role server action, exactly like the portal's
-- client_requests. Answers live as one jsonb blob per response (no per-answer
-- rows), so reading a response is a single indexed row read.

create table if not exists forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete cascade,
  client_id uuid references clients on delete cascade,
  project_id uuid references projects on delete cascade,
  title text not null default 'Untitled form',
  description text,
  status text check (status in ('draft','live','closed')) not null default 'draft',
  content jsonb not null default '{"blocks":[]}'::jsonb,   -- { blocks: FormBlock[] }
  version int not null default 1,                          -- bumped on each publish
  settings jsonb not null default '{}'::jsonb,             -- mode/thanks/limit/closeAt/collectIdentity
  share_token text unique,                                 -- minted on first publish; rotatable
  is_template boolean not null default false,
  -- ONE switch, not two: a project form appears in that project's client portal
  -- when this is on. Opt-in (like share_files) — publishing a link must never
  -- silently add a new surface to a portal the client is already using.
  show_in_portal boolean not null default false,
  view_count int not null default 0,                       -- incremented service-role on public GET
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- exactly one home, or none when it's a template
  constraint forms_one_home check (
    (client_id is not null and project_id is null)
    or (client_id is null and project_id is not null)
    or (client_id is null and project_id is null and is_template)
  )
);
create index if not exists idx_forms_user on forms(user_id, updated_at desc);
create index if not exists idx_forms_client on forms(client_id, updated_at desc);
create index if not exists idx_forms_project on forms(project_id, updated_at desc);
create index if not exists idx_forms_token on forms(share_token);

-- Published snapshots. Written ON PUBLISH only (not per edit) so a response
-- always stays interpretable against the exact questions that were asked.
create table if not exists form_versions (
  form_id uuid references forms on delete cascade not null,
  version int not null,
  content jsonb not null,
  settings jsonb not null default '{}'::jsonb,
  published_at timestamptz default now(),
  primary key (form_id, version)
);

-- One row per respondent attempt. `partial` rows are created on first interaction
-- and upserted as they type — they power resume-after-drop AND the drop-off list
-- (meta.last_field_id). Submitting flips the same row to `complete`.
create table if not exists form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references forms on delete cascade not null,
  form_version int not null default 1,
  status text check (status in ('partial','complete')) not null default 'partial',
  answers jsonb not null default '{}'::jsonb,     -- { [field block id]: value }
  respondent jsonb,                               -- { name?, email? } only when the form asks
  meta jsonb not null default '{}'::jsonb,        -- { source, started_at, completed_at, duration_s, last_field_id }
  -- The fabric link: a response turned into a task keeps a persistent pointer,
  -- so the drawer can show "this became a task" instead of losing the thread
  -- (the same mistake the original acceptRequestAsTask made — see 0017).
  task_id uuid references tasks on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_form_responses_form on form_responses(form_id, status, created_at desc);

drop trigger if exists trg_forms_updated_at on forms;
create trigger trg_forms_updated_at
  before update on forms
  for each row execute function set_updated_at();

drop trigger if exists trg_form_responses_updated_at on form_responses;
create trigger trg_form_responses_updated_at
  before update on form_responses
  for each row execute function set_updated_at();

-- RLS: owner-only everywhere. Public reads/writes never touch these policies —
-- they go through the service role inside token-scoped server actions.
alter table forms enable row level security;
alter table form_versions enable row level security;
alter table form_responses enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='forms' and policyname='sel') then
    create policy sel on forms for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='forms' and policyname='ins') then
    create policy ins on forms for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='forms' and policyname='upd') then
    create policy upd on forms for update using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='forms' and policyname='del') then
    create policy del on forms for delete using (user_id = auth.uid());
  end if;

  -- versions + responses resolve ownership through their parent form
  if not exists (select 1 from pg_policies where tablename='form_versions' and policyname='sel') then
    create policy sel on form_versions for select
      using (exists (select 1 from forms f where f.id = form_id and f.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='form_versions' and policyname='ins') then
    create policy ins on form_versions for insert
      with check (exists (select 1 from forms f where f.id = form_id and f.user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where tablename='form_responses' and policyname='sel') then
    create policy sel on form_responses for select
      using (exists (select 1 from forms f where f.id = form_id and f.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='form_responses' and policyname='upd') then
    create policy upd on form_responses for update
      using (exists (select 1 from forms f where f.id = form_id and f.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='form_responses' and policyname='del') then
    create policy del on form_responses for delete
      using (exists (select 1 from forms f where f.id = form_id and f.user_id = auth.uid()));
  end if;
end $$;

-- Atomic view counter. SECURITY DEFINER so the token-scoped public loader (service
-- role) can bump it without opening any table policy; it only ever touches this
-- one integer on one row.
create or replace function increment_form_views(p_form_id uuid)
returns void language sql security definer set search_path = public as $$
  update forms set view_count = view_count + 1 where id = p_form_id;
$$;

-- Realtime so the owner's responses table updates the moment someone submits.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'form_responses'
  ) then
    execute 'alter publication supabase_realtime add table public.form_responses';
  end if;
end $$;
