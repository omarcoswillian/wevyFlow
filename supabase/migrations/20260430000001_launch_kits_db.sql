-- launch_kits: persists launch kits (previously localStorage-only) with brand link
create table if not exists public.launch_kits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  brand_kit_id  uuid references public.brand_kits(id) on delete set null,
  strategy_id   text not null,
  brand_info    jsonb not null default '{}',
  brand_identity jsonb,
  assets        jsonb not null default '[]',
  briefing      jsonb not null default '{}',
  status        text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  project_id    uuid references public.projects(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists launch_kits_user_id_idx on public.launch_kits(user_id);
create index if not exists launch_kits_updated_at_idx on public.launch_kits(updated_at desc);

alter table public.launch_kits enable row level security;

create policy "launch_kits_owner" on public.launch_kits
  for all using (auth.uid() = user_id);

create or replace trigger launch_kits_updated_at
  before update on public.launch_kits
  for each row execute procedure public.set_updated_at();
