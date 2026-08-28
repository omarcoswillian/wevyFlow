-- ================================================================
-- WevyFlow: token-based lead capture (safe for pages hosted outside
-- WevyFlow — Webflow, WordPress, static HTML, etc)
--
-- Why: /api/public/leads previously resolved the page owner purely from
-- a human-readable `page_slug`, with no auth, no rate limiting and no
-- captcha. Anyone who could see/guess a slug could insert unlimited fake
-- leads into that user's account. This migration adds an unguessable
-- token per page/export so routing no longer depends on the slug.
-- Execute no painel SQL do Supabase
-- ================================================================

-- 1. Token-based routing for pages published at /p/[slug]
alter table published_pages
  add column if not exists public_token uuid not null default gen_random_uuid();

create unique index if not exists pp_public_token_idx on published_pages (public_token);

-- 2. Lead sources for pages that live OUTSIDE WevyFlow (Webflow embed,
--    WordPress plugin, Elementor, raw HTML download) — these never get a
--    published_pages row, but still need a token to route leads back home.
create table if not exists lead_sources (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  token       uuid default gen_random_uuid() not null,
  title       text default 'Página exportada',
  platform    text default 'export',
  created_at  timestamptz default now() not null
);

alter table lead_sources enable row level security;

create policy "users own their lead sources"
  on lead_sources for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create unique index if not exists lead_sources_token_idx on lead_sources (token);
create index if not exists lead_sources_user_id_idx on lead_sources (user_id);

-- 3. Leads now record which token routed them (nullable — old rows stay valid)
alter table leads add column if not exists source_token uuid;
create index if not exists leads_source_token_idx on leads (source_token);
