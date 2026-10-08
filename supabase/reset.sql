-- ============================================================================
-- RESET: deletes ALL app data AND all user accounts, so you can start from scratch.
-- Cannot be undone. Paste into Supabase → SQL Editor → Run.
-- Tables are kept (no need to re-run setup.sql afterwards).
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array['feedback', 'descriptions', 'generation_job_items', 'generation_jobs', 'products', 'retailers', 'market_insights'] loop
    if to_regclass('public.' || t) is not null then
      execute format('truncate table public.%I restart identity cascade', t);
    end if;
  end loop;
end $$;

-- All sign-ups (everyone will need to sign up again).
delete from auth.users;
