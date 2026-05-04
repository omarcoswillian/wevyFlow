-- ai_usage_log: tracks every AI call per user for billing/analytics
create table if not exists public.ai_usage_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  action      text not null,
  tokens_used int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists ai_usage_log_user_id_idx on public.ai_usage_log(user_id);
create index if not exists ai_usage_log_created_at_idx on public.ai_usage_log(created_at desc);

alter table public.ai_usage_log enable row level security;

create policy "ai_usage_log_owner" on public.ai_usage_log
  for all using (auth.uid() = user_id);

-- user_credits: tracks monthly credit consumption per user
create table if not exists public.user_credits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  credits_used   int not null default 0,
  credits_limit  int not null default 10,
  reset_at       timestamptz not null default date_trunc('month', now()) + interval '1 month',
  constraint user_credits_user_id_key unique (user_id)
);

create index if not exists user_credits_user_id_idx on public.user_credits(user_id);

alter table public.user_credits enable row level security;

create policy "user_credits_owner" on public.user_credits
  for all using (auth.uid() = user_id);

-- deduct_credit: atomically logs usage and checks limit.
-- Returns true if credit was deducted, false if limit reached.
create or replace function public.deduct_credit(
  p_user_id uuid,
  p_action  text,
  p_tokens  int default 0
) returns boolean
language plpgsql
security definer
as $$
declare
  v_used  int;
  v_limit int;
begin
  -- upsert credit row for this user
  insert into public.user_credits (user_id, credits_used, credits_limit)
  values (p_user_id, 0, 10)
  on conflict (user_id) do nothing;

  -- reset if past reset_at
  update public.user_credits
  set credits_used = 0,
      reset_at = date_trunc('month', now()) + interval '1 month'
  where user_id = p_user_id and reset_at <= now();

  select credits_used, credits_limit
  into v_used, v_limit
  from public.user_credits
  where user_id = p_user_id;

  if v_used >= v_limit then
    return false;
  end if;

  -- increment usage and log
  update public.user_credits
  set credits_used = credits_used + 1
  where user_id = p_user_id;

  insert into public.ai_usage_log (user_id, action, tokens_used)
  values (p_user_id, p_action, p_tokens);

  return true;
end;
$$;
