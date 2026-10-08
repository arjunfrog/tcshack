-- AI Product Content Intelligence Platform Schema Extensions
-- Tables supporting retailer content intelligence, product evidence store,
-- review themes, explainability (claim-evidence tracing), and feedback patterns.
-- Run in Supabase SQL editor after 20261008010000_retailers.sql.

-- 1. Retailer Content Profile
-- Stores empirical writing patterns extracted from the retailer's existing catalogue
-- (tone, sentence structure, CTA style, vocabulary patterns, preferred lengths).
create table if not exists public.retailer_content_profile (
  id                  uuid primary key default gen_random_uuid(),
  retailer_id         uuid not null unique references public.retailers (id) on delete cascade,
  sample_size         integer not null default 0,
  preferred_tone      text,
  avg_desc_length     integer,
  sentence_style      text,            -- e.g. 'punchy', 'descriptive', 'conversational'
  vocabulary_patterns jsonb not null default '[]'::jsonb, -- common phrases, preferred terms
  benefit_vs_feature  numeric(3, 2),   -- ratio 0.0 (pure feature) to 1.0 (pure benefit)
  title_structure     text,            -- e.g. '[Brand] [Product] - [Key Feature]'
  bullet_structure    text,            -- e.g. 'Bold Lead-in: Explanation'
  cta_style           text,
  technical_detail    text,            -- 'high', 'moderate', 'low'
  profile_data        jsonb not null default '{}'::jsonb, -- full flexible payload
  status              text not null default 'ready' check (status in ('pending', 'analyzing', 'ready', 'failed')),
  last_analyzed_at    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists retailer_content_profile_retailer_idx on public.retailer_content_profile (retailer_id);

drop trigger if exists retailer_content_profile_updated_at on public.retailer_content_profile;
create trigger retailer_content_profile_updated_at
  before update on public.retailer_content_profile
  for each row execute function public.set_updated_at();

-- 2. Product Evidence Store
-- Atomic pieces of evidence gathered from user specs, official docs, web crawls, or marketplaces.
create table if not exists public.product_evidence (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products (id) on delete cascade,
  retailer_id     uuid references public.retailers (id) on delete cascade,
  source_type     text not null check (source_type in ('spec', 'official_web', 'marketplace', 'review', 'visual', 'manual')),
  source_url      text,
  source_name     text not null default 'catalog',
  claim_or_fact   text not null,
  category        text not null default 'specification', -- 'feature', 'spec', 'benefit', 'limitation', 'usage', 'competitor'
  confidence      numeric(3, 2) not null default 1.0 check (confidence between 0.0 and 1.0),
  raw_context     text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists product_evidence_product_idx on public.product_evidence (product_id, source_type);

-- 3. Product Intelligence
-- Synthesized, canonical intelligence for a product (benefits, use cases, target audience, differentiators).
create table if not exists public.product_intelligence (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null unique references public.products (id) on delete cascade,
  retailer_id         uuid references public.retailers (id) on delete cascade,
  canonical_facts     jsonb not null default '[]'::jsonb,
  key_benefits        jsonb not null default '[]'::jsonb,
  use_cases           jsonb not null default '[]'::jsonb,
  target_audience     jsonb not null default '[]'::jsonb,
  differentiators     jsonb not null default '[]'::jsonb,
  buyer_questions     jsonb not null default '[]'::jsonb,
  unresolved_gaps     jsonb not null default '[]'::jsonb,
  overall_confidence  numeric(3, 2) not null default 0.90 check (overall_confidence between 0.0 and 1.0),
  summary             text,
  evidence_count      integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists product_intelligence_product_idx on public.product_intelligence (product_id);

drop trigger if exists product_intelligence_updated_at on public.product_intelligence;
create trigger product_intelligence_updated_at
  before update on public.product_intelligence
  for each row execute function public.set_updated_at();

-- 4. Review Themes
-- Aggregated recurring patterns, sentiment, and quotes from customer reviews.
create table if not exists public.review_themes (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products (id) on delete cascade,
  theme           text not null,
  sentiment       text not null check (sentiment in ('positive', 'negative', 'neutral', 'mixed')),
  strength        numeric(3, 2) not null default 0.50 check (strength between 0.0 and 1.0),
  mention_count   integer not null default 1,
  sample_quotes   text[] not null default '{}',
  source_channel  text,
  created_at      timestamptz not null default now()
);

create index if not exists review_themes_product_idx on public.review_themes (product_id, sentiment);

-- 5. Generation Evidence (Claim-to-Evidence Explainability)
-- Maps specific claims or sentences in generated copy back to supporting evidence.
create table if not exists public.generation_evidence (
  id              uuid primary key default gen_random_uuid(),
  description_id  uuid not null references public.descriptions (id) on delete cascade,
  product_id      uuid not null references public.products (id) on delete cascade,
  claim_text      text not null,
  section         text not null default 'long_description', -- 'title', 'short_description', 'bullet', 'long_description'
  evidence_id     uuid references public.product_evidence (id) on delete set null,
  source_type     text not null default 'spec',
  source_label    text not null default 'Verified Product Spec',
  confidence      numeric(3, 2) not null default 1.0,
  rationale       text,
  created_at      timestamptz not null default now()
);

create index if not exists generation_evidence_description_idx on public.generation_evidence (description_id);

-- 6. Feedback Patterns
-- Aggregated signals from human edits and feedback ratings to drive continuous learning.
create table if not exists public.feedback_patterns (
  id              uuid primary key default gen_random_uuid(),
  retailer_id     uuid not null references public.retailers (id) on delete cascade,
  pattern_type    text not null check (pattern_type in ('tone', 'length', 'avoid_word', 'emphasize_feature', 'vocabulary', 'structure')),
  pattern_detail  text not null,
  frequency       integer not null default 1,
  confidence      numeric(3, 2) not null default 0.5 check (confidence between 0.0 and 1.0),
  sample_diffs    jsonb not null default '[]'::jsonb,
  is_applied      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists feedback_patterns_retailer_idx on public.feedback_patterns (retailer_id, pattern_type);

-- Enable Row Level Security on all new tables
alter table public.retailer_content_profile enable row level security;
alter table public.product_evidence         enable row level security;
alter table public.product_intelligence     enable row level security;
alter table public.review_themes            enable row level security;
alter table public.generation_evidence      enable row level security;
alter table public.feedback_patterns        enable row level security;
