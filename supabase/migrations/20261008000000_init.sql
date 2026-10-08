-- Initial schema for the product description generator.
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL editor.

create extension if not exists pgcrypto;

-- Structured product attributes (the generator's input).
create table if not exists public.products (
  id                 uuid primary key default gen_random_uuid(),
  sku                text unique,
  name               text not null,
  category           text not null,
  subcategory        text,
  brand              text,
  price              numeric(12, 2) check (price >= 0),
  currency           text not null default 'INR',
  features           jsonb not null default '[]'::jsonb,
  specifications     jsonb not null default '{}'::jsonb,
  attributes         jsonb not null default '{}'::jsonb,
  image_url          text,
  seed_keywords      text[] not null default '{}',
  source             text not null default 'manual' check (source in ('manual', 'csv', 'json', 'synthetic')),
  completeness_score smallint check (completeness_score between 0 and 100),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category);

-- One row per batch run, so the UI can show progress and history.
create table if not exists public.generation_jobs (
  id          uuid primary key default gen_random_uuid(),
  status      text not null default 'queued'
              check (status in ('queued', 'running', 'completed', 'partial', 'failed')),
  options     jsonb not null default '{}'::jsonb,  -- tone, length, brand_voice, model
  total       integer not null default 0,
  succeeded   integer not null default 0,
  failed      integer not null default 0,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);

-- Generated copy. A product can have many versions (different tones, regenerations).
create table if not exists public.descriptions (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products (id) on delete cascade,
  job_id            uuid references public.generation_jobs (id) on delete set null,
  version           integer not null default 1,
  tone              text not null,
  length            text not null,
  title             text not null,
  short_description text not null,
  long_description  text not null,
  bullet_points     jsonb not null default '[]'::jsonb,
  seo_keywords      text[] not null default '{}',
  meta_description  text not null,
  quality           jsonb not null default '{}'::jsonb,  -- output of checkCompleteness / checkSeo
  provider          text not null,
  model             text not null,
  input_tokens      integer,
  output_tokens     integer,
  latency_ms        integer,
  status            text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  created_at        timestamptz not null default now(),
  unique (product_id, version)
);

create index if not exists descriptions_product_idx on public.descriptions (product_id, created_at desc);
create index if not exists descriptions_job_idx on public.descriptions (job_id);

-- Reviewer ratings. The "85%+ relevance/creativity" success metric is computed from here.
create table if not exists public.feedback (
  id             uuid primary key default gen_random_uuid(),
  description_id uuid not null references public.descriptions (id) on delete cascade,
  relevance      smallint check (relevance between 1 and 5),
  creativity     smallint check (creativity between 1 and 5),
  comment        text,
  created_at     timestamptz not null default now()
);

create index if not exists feedback_description_idx on public.feedback (description_id);

-- Keep products.updated_at current.
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Row Level Security on, with no policies: the browser's anon key can read nothing.
-- All access goes through the Express API, which uses the service role key.
alter table public.products        enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.descriptions    enable row level security;
alter table public.feedback        enable row level security;
