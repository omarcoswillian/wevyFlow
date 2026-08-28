-- ================================================================
-- WevyFlow: fix public read on /p/[slug] + demote it to a temporary
-- preview link instead of permanent hosting.
--
-- Bug fixed: src/app/p/[slug]/route.ts reads published_pages with the
-- ANON key (src/lib/supabase/server.ts), but the only RLS policy on the
-- table restricts SELECT to `auth.uid() = user_id` — so a logged-out
-- visitor (i.e. every real visitor of a published link) could never
-- actually see the page. This adds a public SELECT policy.
--
-- Product decision: WevyFlow generates, the user hosts elsewhere
-- (WordPress/Webflow export). /p/[slug] stays only as a temporary
-- preview/approval link, not production hosting — so it expires.
-- Execute no painel SQL do Supabase
-- ================================================================

alter table published_pages
  add column if not exists expires_at timestamptz not null default (now() + interval '14 days');

create index if not exists pp_expires_at_idx on published_pages (expires_at);

-- Permissive policies for the same command (SELECT) are OR'd together in
-- Postgres RLS, so this adds public read for non-expired pages on top of
-- the existing owner-only "for all" policy — it doesn't weaken it.
create policy "public can view non-expired published pages"
  on published_pages for select
  using (expires_at > now());
