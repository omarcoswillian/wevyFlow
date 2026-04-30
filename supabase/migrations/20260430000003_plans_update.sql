-- Add 'starter' to plan check constraint
alter table public.user_profiles
  drop constraint if exists user_profiles_plan_check;

alter table public.user_profiles
  add constraint user_profiles_plan_check
  check (plan in ('free', 'starter', 'pro', 'scale'));

-- Add generation type column to generation_history for analytics
alter table public.generation_history
  add column if not exists gen_type text not null default 'landing_page';

-- Allow admins (service_role) to update any user profile
-- Service role bypasses RLS by default, so this is just documentation.
-- To set a plan via SQL: UPDATE user_profiles SET plan = 'pro' WHERE user_id = '<uuid>';
