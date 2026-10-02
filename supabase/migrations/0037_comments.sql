-- Comments become FACTS — §7H's block comments, and the fix for a live defect.
--
-- WHERE THEY LIVE TODAY, and why that is wrong. A document's comments are an array
-- inside `pages.content` (`DocMeta.comments`), written by the document's own
-- autosave. That has three consequences, and the third is data loss:
--
--   1. They are page-level only. There is no way to say "this paragraph".
--   2. Two tabs editing one page overwrite each other's comments, because the
--      whole `content` blob is the unit of write.
--   3. **`restoreVersion` overwrites `content` wholesale**, so restoring any old
--      version silently reverts — or deletes — every comment on the page. A
--      history feature must never destroy something the history is not about.
--
-- This is the same lesson `lib/acceptance.ts` already learned for signatures: a
-- fact somebody else asserted cannot live inside a blob the owner's autosave
-- rewrites. It is a row or it is not trustworthy.
--
-- WHY THIS IS NOT "BLOCKS AS ROWS". Anchoring needs a stable block id, and blocks
-- have had one since the editor was written (see lib/block-link.ts for the audit
-- that established this). `block_id` is therefore TEXT WITH NO FOREIGN KEY, for
-- exactly the reason `mentions.target_id` has none: the thing it points at is not
-- a row. A block deleted out from under a thread leaves an ORPHAN, which the read
-- path surfaces rather than hides — the same tombstone doctrine §7H asks for.
--
-- Additive and idempotent. Everything that reads this table is gated behind
-- `commentsSupported()`, so the app is correct before and after it is applied.

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete cascade,

  -- The document. This one IS a real foreign key: deleting a page really should
  -- take its comments with it, and a page is a row.
  page_id uuid references pages on delete cascade not null,

  -- Which block, or NULL for the document as a whole. Text, not a reference —
  -- see the note above. The page-level thread is the same shape as a block
  -- thread with a null anchor, which is what lets one component draw both.
  block_id text,

  -- A conversation. The first comment mints one; a reply carries it. Resolving
  -- stamps every row that shares it.
  --
  -- Why not treat "the anchor" as the thread: two different questions about the
  -- same paragraph are two conversations, and resolving one must not resolve the
  -- other. Notion models it this way and it costs one column.
  thread_id uuid not null default gen_random_uuid(),

  body text not null,

  -- Snapshotted at write time, like `mentions.context`: rendering an initial
  -- should not cost a join per comment, and a portal guest (whose comments
  -- arrive through the service role, not RLS) has no profile row to join to.
  author_name text,

  -- Resolved is not deleted. A resolved thread is hidden by default and can be
  -- reopened, because "we dealt with this" and "this never happened" are
  -- different claims about the same conversation.
  resolved_at timestamptz,

  created_at timestamptz default now()
);

-- The only hot read is "every comment on this page", drawn in document order by
-- the client. One index covers it.
create index if not exists idx_comments_page on comments(page_id, created_at);
create index if not exists idx_comments_thread on comments(thread_id, created_at);

alter table comments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='comments' and policyname='sel') then
    create policy sel on comments for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='comments' and policyname='ins') then
    create policy ins on comments for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='comments' and policyname='upd') then
    create policy upd on comments for update using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='comments' and policyname='del') then
    create policy del on comments for delete using (user_id = auth.uid());
  end if;
end $$;
