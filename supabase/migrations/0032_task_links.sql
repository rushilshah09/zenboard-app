-- Task dependencies — master plan §7B ("blocked_by (P2, greys the task in Today
-- until blocker completes)") and §3.4's fabric, ledger entry 0032.
--
-- NOTE ON THE LEDGER. §3.3 pairs this number with a second, unrelated piece of
-- work — repointing `milestones` at projects for §7E. That is a different table,
-- a different feature and a different sprint; bundling them would mean neither
-- could be applied without the other. This file is `task_links` only. The
-- milestones repoint keeps the §7E entry and takes its own number when built.
--
-- ONE RELATION TYPE, DELIBERATELY. Linear offers four (blocks, blocked by,
-- relates to, duplicates); Asana has dependencies plus dependents. We ship
-- exactly one edge — "A waits for B" — because:
--
--   · "blocking" is not a second concept, it is the SAME edge read from the
--     other end. Storing both directions is how link tables start disagreeing
--     with themselves;
--   · "relates to" is what the mentions fabric already does (§3.4). A second,
--     weaker way to say "these are connected" would split the graph in two;
--   · "duplicates" is a decision, not a relationship — the answer is to delete
--     one of them.
--
-- §7B's anatomy is frozen and the warning above it is about obesity. One edge.

create table if not exists task_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  -- The task that WAITS.
  task_id uuid references tasks on delete cascade not null,
  -- The task it waits FOR.
  blocked_by_task_id uuid references tasks on delete cascade not null,
  created_at timestamptz default now(),
  -- A task cannot wait for itself. The only cycle a CHECK can catch — longer
  -- ones (A→B→A) need a graph walk and live in lib/task-links.ts, because a
  -- recursive trigger on every insert is a lot of database for a rule the
  -- application must state clearly to the user anyway.
  constraint task_links_no_self check (task_id <> blocked_by_task_id)
);

-- The same dependency added twice is the same dependency. Adding it again must
-- be a no-op, not a second row that makes the blocker list say "Design review"
-- twice.
create unique index if not exists task_links_pair_key
  on task_links(task_id, blocked_by_task_id);

-- Both directions are read on a hot path: a task drawer asks "what am I waiting
-- for?", and completing a task asks "who was waiting for me?".
create index if not exists idx_task_links_task on task_links(task_id);
create index if not exists idx_task_links_blocker on task_links(blocked_by_task_id);

-- ON DELETE CASCADE on both FKs is the contract: deleting a task deletes the
-- edges that mention it. Unlike a mention (§7H, where an orphan is a tombstone
-- worth keeping), a dependency on a task that no longer exists is not history —
-- it is a task that would stay blocked forever by nothing.

alter table task_links enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'task_links' and policyname = 'task_links_owner') then
    create policy task_links_owner on task_links
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- Realtime: a blocker completing on another device should un-grey the waiting
-- task here. `tasks` is already published (0002) and that is the row whose
-- `done` changes, so the edge table itself does not need to be — one less
-- subscription for the same effect.
