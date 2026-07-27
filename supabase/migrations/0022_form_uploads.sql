-- Form Builder — F4 file-upload field (FORM_BUILDER_MASTER_PLAN.md §14).
--
-- A `file` question stores its answer as a storage path, not the bytes: the
-- bytes live in this private bucket, the response's answers jsonb holds only
-- `<formId>/<token>-<original name>`.
--
-- DELIBERATELY no storage.objects policies here. Every path in and out of this
-- bucket runs through the service role inside a token-scoped server action —
-- exactly like form_responses and client_requests:
--   • upload  — the respondent is an anonymous share_token holder (no auth.uid),
--               so uploadFormFile validates the token then writes service-role;
--   • download — signFormUpload verifies the caller OWNS the parent form (RLS
--               select on `forms`) then mints a short-lived signed URL.
-- Opening an RLS policy on storage.objects would only create a second, weaker
-- door to the same bytes. Private bucket + service-role-only is the whole spine.
-- file_size_limit is enforced by storage itself, so it caps the bytes even when
-- the upload arrives through a signed URL our server never sees. 10 MB is plenty
-- for a brief, a logo or a PDF and small enough to keep a shared bucket tidy.
insert into storage.buckets (id, name, public, file_size_limit)
  values ('form-uploads', 'form-uploads', false, 10485760)
  on conflict (id) do nothing;
