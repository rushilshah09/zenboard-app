-- Forms no longer need a home. A form can now start standalone (in Drafts) and be
-- attached to a client or project later — or never. The only rule that remains is
-- that it can't belong to BOTH at once. This relaxes the original 0020 rule, which
-- required exactly one home (or none only for templates).
--
-- Safe to re-run: the constraint is dropped by name first, then re-added.
alter table forms drop constraint if exists forms_one_home;

alter table forms add constraint forms_one_home check (
  not (client_id is not null and project_id is not null)
);
