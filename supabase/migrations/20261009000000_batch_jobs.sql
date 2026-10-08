-- Batch generation jobs (phase 3). A job belongs to a retailer and has one item per
-- product, which moves queued -> running -> succeeded | failed. Workers each update
-- their own item row, so progress needs no shared counters, and "Resume" reruns every
-- item that hasn't succeeded. Run after 20261008010000_retailers.sql (setup.sql includes it).

alter table public.generation_jobs add column if not exists retailer_id uuid references public.retailers (id) on delete cascade;
-- Jobs from before accounts existed have no owner and can't be shown to anyone.
delete from public.generation_jobs where retailer_id is null;
alter table public.generation_jobs alter column retailer_id set not null;
alter table public.generation_jobs add column if not exists started_at timestamptz;
create index if not exists generation_jobs_retailer_idx on public.generation_jobs (retailer_id, created_at desc);

create table if not exists public.generation_job_items (
  job_id         uuid not null references public.generation_jobs (id) on delete cascade,
  product_id     uuid not null references public.products (id) on delete cascade,
  status         text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  error          text,
  description_id uuid references public.descriptions (id) on delete set null,
  updated_at     timestamptz not null default now(),
  primary key (job_id, product_id)
);

alter table public.generation_job_items enable row level security;

notify pgrst, 'reload schema';
