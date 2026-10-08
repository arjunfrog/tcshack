-- Review, feedback and metrics (phase 4). Ratings record who gave them, so each team
-- member rates a description once (re-rating updates it). A human edit is saved as a new
-- description version that points back at the AI version it changed. Run after
-- 20261009000000_batch_jobs.sql (setup.sql includes it).

alter table public.feedback add column if not exists reviewer_id uuid references auth.users (id) on delete set null;
create unique index if not exists feedback_description_reviewer_key on public.feedback (description_id, reviewer_id);

alter table public.descriptions add column if not exists edited_from uuid references public.descriptions (id) on delete set null;
alter table public.descriptions add column if not exists reviewed_by uuid references auth.users (id) on delete set null;
alter table public.descriptions add column if not exists reviewed_at timestamptz;

notify pgrst, 'reload schema';
