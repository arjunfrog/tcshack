-- Retailer accounts. Each Supabase Auth user owns one retailer profile, filled in
-- during onboarding, and products now belong to a retailer.
-- Run this in the Supabase SQL editor after 20261008000000_init.sql.

create table if not exists public.retailers (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null unique references auth.users (id) on delete cascade,
  business_name      text not null,
  seller_type        text not null check (seller_type in ('existing', 'new')),
  -- Where they already sell (existing sellers): amazon, flipkart, meesho, myntra, nykaa, shopify, website, offline, other
  channels           text[] not null default '{}',
  store_url          text,
  categories         text[] not null default '{}',
  target_customer    text,
  price_positioning  text check (price_positioning in ('budget', 'mid', 'premium')),
  brand_personality  text[] not null default '{}',
  admired_brands     text,
  words_to_avoid     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists retailers_set_updated_at on public.retailers;
create trigger retailers_set_updated_at
  before update on public.retailers
  for each row execute function public.set_updated_at();

alter table public.retailers enable row level security;

-- Products belong to a retailer. Products imported before accounts existed have no
-- owner, so they are removed; reload them from the Catalog tab after logging in.
alter table public.products add column if not exists retailer_id uuid references public.retailers (id) on delete cascade;
delete from public.products where retailer_id is null;
alter table public.products alter column retailer_id set not null;

-- SKUs only need to be unique within one retailer's catalog.
alter table public.products drop constraint if exists products_sku_key;
alter table public.products drop constraint if exists products_retailer_sku_key;
alter table public.products add constraint products_retailer_sku_key unique (retailer_id, sku);
create index if not exists products_retailer_idx on public.products (retailer_id, category);
