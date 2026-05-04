-- brand_kits: stores user brand identity (logo, colors, fonts, voice)
create table if not exists public.brand_kits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Minha Marca',
  logo_url    text not null default '',
  colors      jsonb not null default '{"primary":"#a78bfa","secondary":"#6366f1","accent":"#ec4899","bg":"#09090b","text":"#fafafa"}',
  fonts       jsonb not null default '{"heading":"Sora","body":"Inter"}',
  voice_tone  text not null default '',
  photos      jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists brand_kits_user_id_idx on public.brand_kits(user_id);

alter table public.brand_kits enable row level security;

create policy "brand_kits_owner" on public.brand_kits
  for all using (auth.uid() = user_id);

create or replace trigger brand_kits_updated_at
  before update on public.brand_kits
  for each row execute procedure public.set_updated_at();
