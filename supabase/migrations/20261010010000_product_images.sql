-- Product photos (afreen-branch): a public Storage bucket for uploaded photos, and credit
-- columns for free stock photos picked from Pexels. Run after 20261010000000_market_insights.sql
-- (setup.sql includes it).

alter table public.products add column if not exists image_credit text;      -- e.g. "Jane Doe on Pexels"
alter table public.products add column if not exists image_credit_url text;  -- link to the photo's page

-- Public bucket: anyone with a photo's URL can view it (it's shown on product pages); only the
-- API, using the secret key, can upload or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
