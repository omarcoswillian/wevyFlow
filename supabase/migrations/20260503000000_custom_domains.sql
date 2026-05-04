-- custom_domains: one custom domain per user account
create table if not exists public.custom_domains (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  domain      text not null,
  status      text not null default 'pending' check (status in ('pending', 'verified', 'error')),
  verified_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint custom_domains_user_id_key unique (user_id)
);

alter table public.custom_domains enable row level security;

create policy "Users can read own domain"
  on public.custom_domains for select
  using (auth.uid() = user_id);

create policy "Users can insert own domain"
  on public.custom_domains for insert
  with check (auth.uid() = user_id);

create policy "Users can update own domain"
  on public.custom_domains for update
  using (auth.uid() = user_id);

create policy "Users can delete own domain"
  on public.custom_domains for delete
  using (auth.uid() = user_id);
