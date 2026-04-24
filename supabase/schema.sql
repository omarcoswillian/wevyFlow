-- WevyFlow Database Schema
-- Execute este SQL no Supabase SQL Editor (https://app.supabase.com → SQL Editor)

-- ─── Tabela de projetos ───────────────────────────────────────────────────────
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  client      text not null default '',
  starred     boolean not null default false,
  thumbnail   text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Tabela de páginas de projeto ─────────────────────────────────────────────
create table if not exists public.project_pages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects(id) on delete cascade not null,
  name        text not null,
  code        text not null default '',
  platform    text not null default 'html' check (platform in ('html', 'elementor', 'webflow')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Tabela de histórico de gerações ──────────────────────────────────────────
create table if not exists public.generation_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  prompt      text not null,
  platform    text not null default 'html' check (platform in ('html', 'elementor', 'webflow')),
  code        text not null default '',
  created_at  timestamptz not null default now()
);

-- ─── Índices ──────────────────────────────────────────────────────────────────
create index if not exists projects_user_id_idx         on public.projects(user_id);
create index if not exists projects_updated_at_idx      on public.projects(updated_at desc);
create index if not exists project_pages_project_id_idx on public.project_pages(project_id);
create index if not exists generation_history_user_idx  on public.generation_history(user_id);
create index if not exists generation_history_created_idx on public.generation_history(created_at desc);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.projects          enable row level security;
alter table public.project_pages     enable row level security;
alter table public.generation_history enable row level security;

-- Projetos: cada usuário gerencia apenas os seus
create policy "projects_owner" on public.projects
  for all using (auth.uid() = user_id);

-- Páginas: acessíveis via projeto do usuário
create policy "project_pages_owner" on public.project_pages
  for all using (
    exists (
      select 1 from public.projects
      where id = project_id and user_id = auth.uid()
    )
  );

-- Histórico: cada usuário vê apenas o seu
create policy "history_owner" on public.generation_history
  for all using (auth.uid() = user_id);

-- ─── Trigger: atualizar updated_at automaticamente ────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

create or replace trigger project_pages_updated_at
  before update on public.project_pages
  for each row execute procedure public.set_updated_at();
