-- ================================================================
-- WevyFlow: creative_library — biblioteca de referências de design
-- Execute no painel SQL do Supabase
-- ================================================================

create table if not exists creative_library (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  url        text not null,
  name       text,
  format     text,
  tags       text[] default '{}',
  created_at timestamptz default now() not null
);

alter table creative_library enable row level security;

create policy "users own their library"
  on creative_library for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists creative_library_user_id_idx on creative_library (user_id);
create index if not exists creative_library_created_at_idx on creative_library (created_at desc);
