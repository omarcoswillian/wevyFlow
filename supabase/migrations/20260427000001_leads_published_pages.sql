-- ================================================================
-- WevyFlow: published_pages + leads
-- Execute no painel SQL do Supabase
-- ================================================================

-- 1. Páginas publicadas (hospedagem wevyflow.com/p/slug)
create table if not exists published_pages (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  slug        text unique not null,
  title       text not null default 'WevyFlow Page',
  html        text not null default '',
  kit_id      text,
  page_type   text,
  views       integer default 0 not null,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

alter table published_pages enable row level security;

create policy "users own their published pages"
  on published_pages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public read (for /p/[slug] route using service key — não precisa de policy pública)

-- 2. Leads capturados pelas páginas
create table if not exists leads (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  page_slug    text,
  page_title   text,
  name         text,
  email        text,
  phone        text,
  extra        jsonb default '{}',
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  referrer     text,
  ip           text,
  created_at   timestamptz default now() not null
);

alter table leads enable row level security;

create policy "users own their leads"
  on leads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Índices
create index if not exists leads_user_id_idx       on leads (user_id);
create index if not exists leads_page_slug_idx     on leads (page_slug);
create index if not exists leads_created_at_idx    on leads (created_at desc);
create index if not exists pp_slug_idx             on published_pages (slug);
create index if not exists pp_user_id_idx          on published_pages (user_id);

-- 4. SUPABASE_SERVICE_KEY precisa estar no .env para as rotas públicas
--    (não é a anon key — é a service_role key do painel Supabase > Settings > API)
