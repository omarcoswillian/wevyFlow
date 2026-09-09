-- P0: Lançamento (projects + launch_kits) as the single persisted source of
-- truth. Previously launch_kits existed in schema but the app only ever
-- wrote kits to localStorage — this migration makes the relational path the
-- one the app actually uses, and enforces "1 projeto = 1 lançamento".
--
-- NOTE: this migration has NOT been applied/tested against a real Postgres
-- instance (local Supabase requires Docker, which was unavailable in this
-- environment). Review carefully before running against any real database,
-- and run it against a local/staging project first, never production.

-- ── Guard: refuse to proceed if existing data would violate the new
--    constraints. We never silently fix/delete/reassign rows here.
do $$
declare
  v_null_project_id int;
  v_dup_project_id int;
  v_owner_mismatch int;
begin
  select count(*) into v_null_project_id
    from public.launch_kits where project_id is null;

  select count(*) into v_dup_project_id
    from (
      select project_id from public.launch_kits
      where project_id is not null
      group by project_id having count(*) > 1
    ) d;

  select count(*) into v_owner_mismatch
    from public.launch_kits lk
    join public.projects p on p.id = lk.project_id
    where lk.user_id <> p.user_id;

  if v_null_project_id > 0 or v_dup_project_id > 0 or v_owner_mismatch > 0 then
    raise exception
      'launches_p0 migration blocked: % launch_kits with null project_id, % projects with more than one kit, % owner mismatches. Resolve manually before re-running this migration — no automatic reassignment/deletion will be performed.',
      v_null_project_id, v_dup_project_id, v_owner_mismatch;
  end if;
end $$;

-- ── Schema changes ──────────────────────────────────────────────────────

alter table public.launch_kits
  add column if not exists client_token text,
  add column if not exists email_sequences jsonb not null default '{"cpl": [], "vendas": [], "recuperacao": []}'::jsonb;

-- project_id becomes mandatory and 1:1 with projects.
alter table public.launch_kits
  alter column project_id set not null;

alter table public.launch_kits
  drop constraint if exists launch_kits_project_id_fkey;

alter table public.launch_kits
  add constraint launch_kits_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete restrict;

-- One kit per project.
create unique index if not exists launch_kits_project_id_key
  on public.launch_kits(project_id);

-- Idempotent-create support: one client_token per user maps to at most one kit.
create unique index if not exists launch_kits_user_client_token_key
  on public.launch_kits(user_id, client_token)
  where client_token is not null;

-- strategy_id is only required once a kit is active — a draft can be saved
-- before the user picks a strategy.
alter table public.launch_kits
  alter column strategy_id drop not null;

-- Ownership consistency: launch_kits.user_id must match projects.user_id.
-- Enforced via trigger (a CHECK constraint can't do a cross-table lookup).
create or replace function public.enforce_launch_kit_owner()
returns trigger language plpgsql as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.projects where id = new.project_id;
  if v_owner is null then
    raise exception 'launch_kits.project_id references a nonexistent project';
  end if;
  if v_owner <> new.user_id then
    raise exception 'launch_kits.user_id must match the owner of projects.id (%).', new.project_id;
  end if;
  return new;
end;
$$;

drop trigger if exists launch_kits_owner_consistency on public.launch_kits;
create trigger launch_kits_owner_consistency
  before insert or update on public.launch_kits
  for each row execute procedure public.enforce_launch_kit_owner();

-- Minimum-briefing/strategy requirement to go "active" — mirrors the
-- server-side validation in src/app/lib/launch-briefing.ts, enforced again
-- here as a safety net against writes that bypass the API.
alter table public.launch_kits
  drop constraint if exists launch_kits_active_requires_briefing;

alter table public.launch_kits
  add constraint launch_kits_active_requires_briefing
  check (
    status <> 'active'
    or (
      strategy_id is not null
      and coalesce(nullif(trim(briefing->>'productName'), ''), '') <> ''
      and coalesce(nullif(trim(briefing->>'niche'), ''), '') <> ''
      and coalesce(nullif(trim(briefing->>'targetAudience'), ''), '') <> ''
      and coalesce(nullif(trim(briefing->>'transformation'), ''), '') <> ''
    )
  );

-- ── Atomic save: creates or updates the (projects, launch_kits) pair in a
--    single transaction. Runs as the calling user (not SECURITY DEFINER) so
--    the existing RLS policies on projects/launch_kits apply normally —
--    auth.uid() is read from the JWT, never trusted from a client param.
--
-- Revision note (post-review fixes): p_status is now nullable — null means
-- "leave the current status untouched" on update (required on create, since
-- there's nothing to preserve there yet). p_clear_strategy/p_clear_brand_identity
-- let a caller explicitly null out those two fields, which plain
-- coalesce(p_x, x) could never do (coalesce always keeps the old value when
-- passed null, so "field omitted" and "field explicitly cleared" were
-- indistinguishable). The client_token create path now also survives a
-- concurrent duplicate insert and never lets a stale retry revert an
-- already-activated launch back to draft or overwrite newer data.
create or replace function public.save_launch(
  p_project_id uuid,             -- null => create a new launch
  p_client_token text,           -- required when p_project_id is null; used to dedupe retries
  p_briefing jsonb,
  p_brand_info jsonb,
  p_strategy_id text,
  p_status text,                  -- 'draft' | 'active' | 'archived' | null (null = leave unchanged, update-only)
  p_brand_kit_id uuid default null,
  p_assets jsonb default null,           -- null = leave untouched (update) / '[]' (create)
  p_brand_identity jsonb default null,   -- null = leave untouched, unless p_clear_brand_identity
  p_email_sequences jsonb default null,  -- null = leave untouched
  p_clear_strategy boolean default false,
  p_clear_brand_identity boolean default false,
  p_clear_brand_kit_id boolean default false
)
returns table (out_project_id uuid, out_launch_kit_id uuid, out_status text)
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_project_id uuid;
  v_kit_id uuid;
  v_current_status text;
  v_product_name text;
  v_niche text;
  v_target text;
  v_transformation text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_status is not null and p_status not in ('draft', 'active', 'archived') then
    raise exception 'invalid_status: %', p_status using errcode = '22023';
  end if;

  if p_project_id is null and p_status is null then
    raise exception 'status_required_on_create' using errcode = '22023';
  end if;

  v_product_name  := nullif(trim(p_briefing->>'productName'), '');
  v_niche         := nullif(trim(p_briefing->>'niche'), '');
  v_target        := nullif(trim(p_briefing->>'targetAudience'), '');
  v_transformation:= nullif(trim(p_briefing->>'transformation'), '');

  if p_status = 'active' and (
       v_product_name is null or v_niche is null or v_target is null
       or v_transformation is null or p_strategy_id is null
     ) then
    raise exception 'briefing_incomplete' using errcode = '22023';
  end if;

  if p_project_id is null then
    ---------------------------------------------------------------------
    -- CREATE (idempotent on client_token)
    ---------------------------------------------------------------------
    if p_client_token is null or trim(p_client_token) = '' then
      raise exception 'client_token_required' using errcode = '22023';
    end if;

    -- `for update` locks the row (if it already exists) for the rest of
    -- this transaction, so a concurrent call racing on the same
    -- client_token — or a concurrent UPDATE-by-project_id call below —
    -- blocks until this transaction commits, instead of both reading a
    -- stale 'draft' status and one clobbering the other's write (see
    -- launches review item D).
    select lk.project_id, lk.id, lk.status into v_project_id, v_kit_id, v_current_status
      from public.launch_kits lk
      where lk.user_id = v_uid and lk.client_token = p_client_token
      for update;

    if v_kit_id is null then
      -- Wrapped in its own exception block so a unique_violation on
      -- client_token (a concurrent duplicate create winning the race)
      -- rolls back *only* this insert attempt via the implicit savepoint —
      -- including the `projects` row just inserted above it — instead of
      -- leaving an orphan project with no kit.
      begin
        insert into public.projects (user_id, name)
          values (v_uid, coalesce(v_product_name, 'Lançamento em rascunho'))
          returning id into v_project_id;

        insert into public.launch_kits
          (user_id, project_id, client_token, strategy_id, brand_info,
           brand_identity, assets, briefing, status, brand_kit_id, email_sequences)
        values
          (v_uid, v_project_id, p_client_token, p_strategy_id, coalesce(p_brand_info, '{}'::jsonb),
           case when p_clear_brand_identity then null else p_brand_identity end,
           coalesce(p_assets, '[]'::jsonb), p_briefing, p_status, p_brand_kit_id,
           coalesce(p_email_sequences, '{"cpl": [], "vendas": [], "recuperacao": []}'::jsonb))
        returning id, status into v_kit_id, v_current_status;
      exception when unique_violation then
        -- Another concurrent request with the same client_token committed
        -- first — adopt its row instead of failing this one.
        select lk.project_id, lk.id, lk.status into v_project_id, v_kit_id, v_current_status
          from public.launch_kits lk
          where lk.user_id = v_uid and lk.client_token = p_client_token
          for update;
        if v_kit_id is null then
          raise; -- some other unique_violation — surface the original error
        end if;
      end;
    elsif v_current_status in ('active', 'archived') then
      -- This client_token already did its job — the launch moved past
      -- draft. A stale/duplicate create-retry (e.g. a slow request that
      -- landed after the launch was already activated elsewhere) must not
      -- revert it to draft or stomp a newer briefing with an old one.
      -- Callers switch to updating by project_id once they have it; this
      -- is a no-op read of the current state, not an update.
      null;
    else
      -- Same client_token, still draft — treat as a retry/update of the
      -- draft it already created rather than inserting a duplicate.
      --
      -- `and status = 'draft'` is belt-and-suspenders on top of the `for
      -- update` lock above: this branch is only reachable when our locked
      -- read just saw 'draft', so the condition should always match, but
      -- it guarantees the write is a no-op rather than a corruption if that
      -- invariant is ever wrong. If it doesn't match (0 rows updated),
      -- re-read the row so the function still returns the real current
      -- state instead of the stale pre-update status.
      update public.launch_kits set
        strategy_id     = case when p_clear_strategy then null else coalesce(p_strategy_id, strategy_id) end,
        brand_info      = coalesce(p_brand_info, brand_info),
        briefing        = p_briefing,
        status          = coalesce(p_status, status),
        brand_kit_id    = case when p_clear_brand_kit_id then null else coalesce(p_brand_kit_id, brand_kit_id) end,
        assets          = coalesce(p_assets, assets),
        brand_identity  = case when p_clear_brand_identity then null else coalesce(p_brand_identity, brand_identity) end,
        email_sequences = coalesce(p_email_sequences, email_sequences)
      where id = v_kit_id and user_id = v_uid and status = 'draft'
      returning status into v_current_status;

      if not found then
        select status into v_current_status from public.launch_kits where id = v_kit_id;
      end if;

      update public.projects set name = coalesce(v_product_name, name)
        where id = v_project_id and user_id = v_uid;
    end if;
  else
    ---------------------------------------------------------------------
    -- UPDATE — caller must own both the project and its kit
    ---------------------------------------------------------------------
    select lk.id, lk.status into v_kit_id, v_current_status
      from public.launch_kits lk
      where lk.project_id = p_project_id and lk.user_id = v_uid;

    if v_kit_id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;

    update public.launch_kits set
      strategy_id     = case when p_clear_strategy then null else coalesce(p_strategy_id, strategy_id) end,
      brand_info      = coalesce(p_brand_info, brand_info),
      briefing        = p_briefing,
      status          = coalesce(p_status, status),
      brand_kit_id    = case when p_clear_brand_kit_id then null else coalesce(p_brand_kit_id, brand_kit_id) end,
      assets          = coalesce(p_assets, assets),
      brand_identity  = case when p_clear_brand_identity then null else coalesce(p_brand_identity, brand_identity) end,
      email_sequences = coalesce(p_email_sequences, email_sequences)
    where id = v_kit_id and user_id = v_uid
    returning status into v_current_status;

    update public.projects set name = coalesce(v_product_name, name)
      where id = p_project_id and user_id = v_uid;

    v_project_id := p_project_id;
  end if;

  return query select v_project_id, v_kit_id, v_current_status;
end;
$$;

-- RLS already restricts projects/launch_kits reads+writes to their owner
-- (see 20260423000000_init.sql and 20260430000001_launch_kits_db.sql);
-- save_launch runs as the invoking user (no SECURITY DEFINER), so those
-- existing policies keep applying to every insert/update it performs.
