-- ROLLBACK for 0028_rows_are_pages.sql.
--
-- 0028 is purely additive: it creates new `pages` rows and adds four columns.
-- It modifies NO pre-existing data — `collection_rows.data`, `.title` and
-- `.sort_index` are read but never written. So this rollback is total: after it,
-- the database is byte-for-byte where it started.
--
-- ONLY SAFE while no reader has been migrated yet. Once application code writes
-- to `pages.properties` for a row, deleting those pages destroys real edits.
-- The guard below refuses to run if any generated page has been edited since it
-- was created — that is the signal that the app has started using them.

do $$
declare
  edited_count int;
begin
  -- Nothing to undo: 0028 was never applied. Say so plainly and stop, rather
  -- than failing on a column that does not exist yet — running the rollback by
  -- mistake must be harmless, not cryptic.
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'collection_rows' and column_name = 'page_id'
  ) then
    raise notice '0028 is not applied — nothing to roll back. (Did you mean to run 0028_rows_are_pages.sql?)';
    return;
  end if;

  execute $q$
    select count(*) from pages p
    join collection_rows r on r.page_id = p.id
    where p.updated_at > p.created_at + interval '1 second'
  $q$ into edited_count;

  if edited_count > 0 then
    raise exception
      'Refusing to roll back: % generated page(s) have been edited since the backfill. Rolling back now would destroy those edits. Migrate the data out first, or delete the guard deliberately.',
      edited_count;
  end if;
end $$;

-- Unlink first so the delete does not fight the FK. Guarded: the column only
-- exists once 0028 has run.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'collection_rows' and column_name = 'page_id'
  ) then
    execute $q$ update collection_rows set page_id = null where page_id is not null $q$;
  end if;
end $$;

-- Remove only the pages this migration generated. `type = 'row'` is the marker;
-- nothing else in the app writes that value. Guarded the same way: if 0028 was
-- never applied, `database_id` does not exist and there is nothing to delete.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'pages' and column_name = 'database_id'
  ) then
    execute $q$ delete from pages where type = 'row' and database_id is not null $q$;
  end if;
end $$;

drop index if exists idx_collection_rows_page;
drop index if exists idx_pages_properties;
drop index if exists idx_pages_database_order;
drop index if exists idx_pages_database;

alter table collection_rows drop column if exists page_id;

alter table pages
  drop column if exists row_order,
  drop column if exists properties,
  drop column if exists database_id;
