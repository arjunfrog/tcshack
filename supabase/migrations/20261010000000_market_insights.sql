-- Market insights per product type (e.g. "Air Fryer"), fetched from Anakin: real shopper
-- searches and top-ranking listings. Shared by all retailers and refreshed after a week.
-- Run after 20261009000000_batch_jobs.sql (setup.sql includes it).

create table if not exists public.market_insights (
  query_key   text primary key,          -- lower-cased product type
  query       text not null,
  insights    jsonb not null,            -- { search_terms, title_terms, top_listings, sources }
  fetched_at  timestamptz not null default now()
);

alter table public.market_insights enable row level security;
