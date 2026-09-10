-- Rodada A do redesenho de KV (spec do Codex, gpt-5.6-sol, sessão 2026-09-09):
-- agrupamento de candidatos em "kits", SEM nenhuma geração nova.
--
-- Motivo: o dono testou o fluxo de lote (Rodadas 1-3) e voltou com um
-- corretivo de escopo — "KV" no vocabulário do produto não é uma imagem só,
-- é um mini brand-kit (logo, paleta, tipografia, aplicação de logo, textura
-- e ícones, fotos e mockups de aplicação — a mesma estrutura que já existe
-- em public/library-seed/kv-examples/carreira-de-ouro/, hoje só usada como
-- inspiração estática na aba Biblioteca). Cada "candidato" de um lote precisa
-- virar um KIT de várias peças, não uma imagem isolada.
--
-- Esta migration só introduz a entidade "candidato" e agrupa nela o que já
-- existe (um logo por candidato, como hoje) — nenhuma peça nova é gerada
-- ainda. Geração de peças adicionais (paleta, tipografia, textura,
-- aplicação, mockups) fica pra rodadas seguintes, cada uma testável isolada.

-- ── 1. kv_candidates: um candidato = uma direção criativa dentro de um lote.
create table if not exists public.kv_candidates (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  launch_kit_id     uuid not null references public.launch_kits(id) on delete cascade,
  batch_id          uuid not null,
  position          int not null check (position >= 0),
  direction         text,
  schema_version    int not null default 1,
  -- Lista de peças previstas pra este candidato (pieceKey/role/producer/
  -- required/...) — data-driven de propósito: o catálogo de peças pode
  -- crescer (spec do Codex) sem precisar de migration nova a cada peça.
  manifest          jsonb not null default '{}'::jsonb,
  -- Paleta/tipografia/regras estruturadas da identidade — dado de verdade,
  -- as cartelas visuais são derivadas dele (nunca o contrário: nunca ler HEX
  -- ou nome de fonte de uma imagem gerada por IA).
  identity_spec     jsonb not null default '{}'::jsonb,
  -- Briefing/referências/config congelados no momento da criação do lote.
  context_snapshot  jsonb not null default '{}'::jsonb,
  selected_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists kv_candidates_batch_position_key
  on public.kv_candidates(batch_id, position);

create index if not exists kv_candidates_launch_kit_idx
  on public.kv_candidates(launch_kit_id, created_at desc);

alter table public.kv_candidates enable row level security;

-- Mesmo padrão de launch_assets: dono só lê, toda escrita passa por função
-- SECURITY DEFINER (claim_kv_batch, atualizada abaixo).
create policy "kv_candidates_select_owner" on public.kv_candidates
  for select using (auth.uid() = user_id);

create or replace trigger kv_candidates_updated_at
  before update on public.kv_candidates
  for each row execute procedure public.set_updated_at();

create or replace function public.enforce_kv_candidate_owner()
returns trigger language plpgsql as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.launch_kits where id = new.launch_kit_id;
  if v_owner is null then
    raise exception 'kv_candidates.launch_kit_id references a nonexistent launch_kit';
  end if;
  if v_owner <> new.user_id then
    raise exception 'kv_candidates.user_id must match the owner of launch_kits.id (%).', new.launch_kit_id;
  end if;
  return new;
end;
$$;

drop trigger if exists kv_candidates_owner_consistency on public.kv_candidates;
create trigger kv_candidates_owner_consistency
  before insert or update on public.kv_candidates
  for each row execute procedure public.enforce_kv_candidate_owner();

-- Identidade/associação de um candidato não mudam depois de criado — só
-- manifest/identity_spec/context_snapshot (rodadas seguintes acrescentam
-- peças) e selected_at continuam editáveis.
create or replace function public.enforce_kv_candidate_immutability()
returns trigger language plpgsql as $$
begin
  if new.id <> old.id then
    raise exception 'kv_candidates.id is immutable';
  end if;
  if new.created_at <> old.created_at then
    raise exception 'kv_candidates.created_at is immutable';
  end if;
  if new.user_id <> old.user_id then
    raise exception 'kv_candidates.user_id is immutable';
  end if;
  if new.launch_kit_id <> old.launch_kit_id then
    raise exception 'kv_candidates.launch_kit_id is immutable';
  end if;
  if new.batch_id <> old.batch_id then
    raise exception 'kv_candidates.batch_id is immutable';
  end if;
  if new.position <> old.position then
    raise exception 'kv_candidates.position is immutable';
  end if;
  if new.direction is distinct from old.direction then
    raise exception 'kv_candidates.direction is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists kv_candidates_immutability on public.kv_candidates;
create trigger kv_candidates_immutability
  before update on public.kv_candidates
  for each row execute procedure public.enforce_kv_candidate_immutability();

-- ── 2. launch_assets passa a representar UMA PEÇA de um candidato ────────
-- Colunas nascem nullable pra permitir o backfill abaixo; viram NOT NULL
-- (exceto pra linhas de outros asset_type, que nunca preenchem isso) no
-- final desta seção.
alter table public.launch_assets
  add column if not exists candidate_id uuid references public.kv_candidates(id) on delete restrict,
  add column if not exists piece_key    text,
  add column if not exists asset_role   text,
  add column if not exists producer     text check (producer in ('image_ai', 'renderer'));

-- ── 3. Backfill: cada launch_assets(kv) existente vira o único candidato
--    'legacy_logo_only' de si mesmo — nenhum dado é perdido, nenhuma peça
--    nova é criada. batch_id+position já é único por linha, então dá pra
--    mapear de volta sem precisar de um laço.
with backfilled as (
  insert into public.kv_candidates (
    user_id, launch_kit_id, batch_id, position, direction, schema_version,
    manifest, identity_spec, context_snapshot, selected_at, created_at, updated_at
  )
  select
    la.user_id, la.launch_kit_id, la.batch_id, la.position, la.variation_key, 1,
    jsonb_build_object(
      'legacy', true,
      'pieces', jsonb_build_array(
        jsonb_build_object('pieceKey', 'logo_primary', 'role', 'logo', 'producer', 'image_ai', 'required', true)
      )
    ),
    '{}'::jsonb,
    jsonb_build_object('generationConfig', la.generation_config, 'promptSnapshot', la.prompt_snapshot),
    la.selected_at, la.created_at, la.updated_at
  from public.launch_assets la
  where la.asset_type = 'kv' and la.candidate_id is null
  returning id, batch_id, position
)
update public.launch_assets la
  set candidate_id = b.id, piece_key = 'logo_primary', asset_role = 'logo', producer = 'image_ai'
  from backfilled b
  where la.batch_id = b.batch_id and la.position = b.position and la.asset_type = 'kv';

-- Todo launch_assets de asset_type='kv' agora tem candidato — reforça isso
-- pra sempre (linhas de outros asset_type, hoje inexistentes, ficariam de
-- fora desta regra caso o tipo genérico volte a ser usado por outro domínio).
alter table public.launch_assets
  add constraint launch_assets_kv_has_candidate check (
    asset_type <> 'kv' or (
      candidate_id is not null and piece_key is not null and btrim(piece_key) <> ''
      and asset_role is not null and btrim(asset_role) <> ''
      and producer is not null
    )
  );

create unique index if not exists launch_assets_candidate_piece_key
  on public.launch_assets(candidate_id, piece_key) where candidate_id is not null;

-- candidate_id (se presente) precisa apontar pro mesmo dono/lançamento/lote
-- que a própria linha — mesmo raciocínio já aplicado a generation_history_id
-- em enforce_launch_asset_owner (Rodada 1): uma FK só garante que a linha
-- existe, não que ela é consistente com o resto do registro.
create or replace function public.enforce_launch_asset_owner()
returns trigger language plpgsql as $$
declare
  v_owner uuid;
  v_history_owner uuid;
  v_candidate_owner uuid;
  v_candidate_launch_kit_id uuid;
  v_candidate_batch_id uuid;
begin
  select user_id into v_owner from public.launch_kits where id = new.launch_kit_id;
  if v_owner is null then
    raise exception 'launch_assets.launch_kit_id references a nonexistent launch_kit';
  end if;
  if v_owner <> new.user_id then
    raise exception 'launch_assets.user_id must match the owner of launch_kits.id (%).', new.launch_kit_id;
  end if;

  if new.generation_history_id is not null then
    select user_id into v_history_owner from public.generation_history where id = new.generation_history_id;
    if v_history_owner is null then
      raise exception 'launch_assets.generation_history_id references a nonexistent generation_history row';
    end if;
    if v_history_owner <> new.user_id then
      raise exception 'launch_assets.generation_history_id must belong to the same user_id';
    end if;
  end if;

  if new.candidate_id is not null then
    select user_id, launch_kit_id, batch_id
      into v_candidate_owner, v_candidate_launch_kit_id, v_candidate_batch_id
      from public.kv_candidates where id = new.candidate_id;
    if v_candidate_owner is null then
      raise exception 'launch_assets.candidate_id references a nonexistent kv_candidate';
    end if;
    if v_candidate_owner <> new.user_id
       or v_candidate_launch_kit_id <> new.launch_kit_id
       or v_candidate_batch_id <> new.batch_id then
      raise exception 'launch_assets.candidate_id must belong to the same user_id/launch_kit_id/batch_id';
    end if;
  end if;

  return new;
end;
$$;

-- Trigger já existe (Rodada 1) — CREATE OR REPLACE FUNCTION acima já é
-- suficiente pra ativar a checagem nova, sem precisar recriar o trigger.

-- candidate_id/piece_key/asset_role/producer viram imutáveis a partir de
-- agora — igual batch_id/position, incondicionalmente (não só quando done).
create or replace function public.enforce_launch_asset_immutability()
returns trigger language plpgsql as $$
begin
  if new.id <> old.id then
    raise exception 'launch_assets.id is immutable';
  end if;
  if new.created_at <> old.created_at then
    raise exception 'launch_assets.created_at is immutable';
  end if;
  if new.launch_kit_id <> old.launch_kit_id then
    raise exception 'launch_assets.launch_kit_id is immutable';
  end if;
  if new.asset_type <> old.asset_type then
    raise exception 'launch_assets.asset_type is immutable';
  end if;
  if new.batch_id <> old.batch_id then
    raise exception 'launch_assets.batch_id is immutable';
  end if;
  if new.position <> old.position then
    raise exception 'launch_assets.position is immutable';
  end if;
  if new.candidate_id is distinct from old.candidate_id then
    raise exception 'launch_assets.candidate_id is immutable';
  end if;
  if new.piece_key is distinct from old.piece_key then
    raise exception 'launch_assets.piece_key is immutable';
  end if;
  if new.asset_role is distinct from old.asset_role then
    raise exception 'launch_assets.asset_role is immutable';
  end if;
  if new.producer is distinct from old.producer then
    raise exception 'launch_assets.producer is immutable';
  end if;

  if old.status = 'done' and (
       new.status is distinct from old.status
       or new.storage_bucket is distinct from old.storage_bucket
       or new.storage_path is distinct from old.storage_path
       or new.mime_type is distinct from old.mime_type
       or new.width is distinct from old.width
       or new.height is distinct from old.height
       or new.variant is distinct from old.variant
       or new.variation_key is distinct from old.variation_key
       or new.prompt_snapshot is distinct from old.prompt_snapshot
       or new.generation_config is distinct from old.generation_config
       or new.error_code is distinct from old.error_code
       or new.error_message is distinct from old.error_message
       or (new.generation_history_id is distinct from old.generation_history_id
           and new.generation_history_id is not null)
     ) then
    raise exception 'launch_assets in status done are immutable except selected_at and unlinking a deleted generation_history_id';
  end if;

  return new;
end;
$$;

-- ── 4. claim_kv_batch passa a criar um kv_candidate por variação, além do
--    launch_assets de sempre — o candidato nasce com a peça "logo_primary"
--    no manifest (mesma peça única que já existia), pronto pra rodadas
--    seguintes acrescentarem mais peças no mesmo candidato.
create or replace function public.claim_kv_batch(
  p_user_id uuid,
  p_launch_kit_id uuid,
  p_client_batch_id uuid,
  p_asset_type text,
  p_gen_type text,
  p_directions text[],
  p_prompts text[],
  p_generation_config jsonb,
  p_cost_per_item int,
  p_limit int,
  p_skip_credit_check boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_count int;
  v_month_start timestamptz;
  v_used int := 0;
  v_required int := 0;
  v_existing_count int;
  v_existing_config jsonb;
  v_asset_ids uuid[] := '{}';
  v_candidate_ids uuid[] := '{}';
  v_hid uuid;
  v_aid uuid;
  v_cid uuid;
  i int;
begin
  if p_user_id is null then
    raise exception 'user_id_required' using errcode = '22023';
  end if;
  v_count := coalesce(array_length(p_directions, 1), 0);
  if v_count = 0 or coalesce(array_length(p_prompts, 1), 0) <> v_count then
    raise exception 'invalid_batch_shape' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  perform public.reap_stale_kv_generations(p_user_id);

  select user_id into v_owner from public.launch_kits where id = p_launch_kit_id;
  if v_owner is null or v_owner <> p_user_id then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select count(*), (array_agg(generation_config order by position))[1]
    into v_existing_count, v_existing_config
    from public.launch_assets
    where launch_kit_id = p_launch_kit_id and batch_id = p_client_batch_id;

  if v_existing_count > 0 then
    if v_existing_config is distinct from p_generation_config then
      raise exception 'batch_conflict' using errcode = '23505';
    end if;
    return jsonb_build_object('created', false, 'launch_kit_id', p_launch_kit_id, 'batch_id', p_client_batch_id);
  end if;

  if not p_skip_credit_check then
    v_month_start := date_trunc('month', now());
    select coalesce(sum(cost), 0) into v_used
      from public.generation_history
      where user_id = p_user_id and created_at >= v_month_start and status in ('pending', 'success');
    v_required := p_cost_per_item * v_count;

    if v_used + v_required > p_limit then
      return jsonb_build_object(
        'created', false, 'allowed', false,
        'used', v_used, 'limit', p_limit, 'required', v_required
      );
    end if;
  end if;

  for i in 1 .. v_count loop
    insert into public.kv_candidates (
      user_id, launch_kit_id, batch_id, position, direction, schema_version,
      manifest, identity_spec, context_snapshot
    ) values (
      p_user_id, p_launch_kit_id, p_client_batch_id, i - 1, p_directions[i], 1,
      jsonb_build_object(
        'legacy', false,
        'pieces', jsonb_build_array(
          jsonb_build_object('pieceKey', 'logo_primary', 'role', 'logo', 'producer', 'image_ai', 'required', true)
        )
      ),
      '{}'::jsonb,
      jsonb_build_object('generationConfig', p_generation_config)
    ) returning id into v_cid;

    v_candidate_ids := v_candidate_ids || v_cid;

    v_hid := null;
    if not p_skip_credit_check then
      insert into public.generation_history (user_id, prompt, platform, gen_type, code, status, cost, credit_locked)
        values (p_user_id, left(p_prompts[i], 500), 'html', p_gen_type, '', 'pending', p_cost_per_item, true)
        returning id into v_hid;
    end if;

    insert into public.launch_assets (
      user_id, launch_kit_id, asset_type, batch_id, position, status,
      variation_key, prompt_snapshot, generation_config, generation_history_id,
      candidate_id, piece_key, asset_role, producer
    ) values (
      p_user_id, p_launch_kit_id, p_asset_type, p_client_batch_id, i - 1, 'pending',
      p_directions[i], p_prompts[i], p_generation_config, v_hid,
      v_cid, 'logo_primary', 'logo', 'image_ai'
    ) returning id into v_aid;

    v_asset_ids := v_asset_ids || v_aid;
  end loop;

  return jsonb_build_object(
    'created', true, 'allowed', true,
    'launch_kit_id', p_launch_kit_id, 'batch_id', p_client_batch_id,
    'asset_ids', v_asset_ids, 'candidate_ids', v_candidate_ids,
    'used', v_used + v_required, 'limit', p_limit
  );
end;
$$;

revoke all on function public.claim_kv_batch(uuid, uuid, uuid, text, text, text[], text[], jsonb, int, int, boolean)
  from public, anon, authenticated;

-- ── 5. launch_kits.selected_kv_candidate_id — seleção canônica do novo
--    fluxo. selected_kv_asset_id continua existindo, como ponte de
--    compatibilidade pra qualquer leitor que só precise do logo (spec do
--    Codex): select_launch_kv (abaixo) sempre escreve os dois juntos.
alter table public.launch_kits
  add column if not exists selected_kv_candidate_id uuid references public.kv_candidates(id) on delete set null;

-- Só pode apontar pra um candidato do mesmo lançamento/dono, e só quando
-- TODAS as peças já persistidas desse candidato estiverem 'done' (hoje é
-- sempre 1 peça — logo_primary — então isso equivale à checagem antiga de
-- selected_kv_asset_id; rodadas seguintes com mais peças por candidato
-- herdam a mesma regra sem precisar mudar este trigger).
create or replace function public.enforce_selected_kv_candidate()
returns trigger language plpgsql as $$
declare
  v_launch_kit_id uuid;
  v_user_id uuid;
  v_piece_count int;
  v_incomplete_count int;
begin
  if new.selected_kv_candidate_id is null then
    return new;
  end if;

  select launch_kit_id, user_id
    into v_launch_kit_id, v_user_id
    from public.kv_candidates
    where id = new.selected_kv_candidate_id;

  if not found then
    raise exception 'selected_kv_candidate_id references a nonexistent kv_candidate';
  end if;
  if v_launch_kit_id <> new.id then
    raise exception 'selected_kv_candidate_id must belong to the same launch_kit';
  end if;
  if v_user_id <> new.user_id then
    raise exception 'selected_kv_candidate_id must belong to the same owner';
  end if;

  select count(*), count(*) filter (where status <> 'done')
    into v_piece_count, v_incomplete_count
    from public.launch_assets
    where candidate_id = new.selected_kv_candidate_id;

  if v_piece_count = 0 or v_incomplete_count > 0 then
    raise exception 'selected_kv_candidate_id must reference a candidate whose pieces are all done';
  end if;

  return new;
end;
$$;

drop trigger if exists launch_kits_selected_kv_candidate_consistency on public.launch_kits;
create trigger launch_kits_selected_kv_candidate_consistency
  before insert or update on public.launch_kits
  for each row execute procedure public.enforce_selected_kv_candidate();

-- ── 6. select_launch_kv passa a resolver e gravar o candidato também.
--    Precisa de DROP + CREATE (não CREATE OR REPLACE) porque a lista de
--    colunas de retorno muda.
drop function if exists public.select_launch_kv(uuid, uuid);

create function public.select_launch_kv(
  p_project_id uuid,
  p_asset_id uuid
)
returns table (
  out_launch_kit_id uuid,
  out_project_id uuid,
  out_selected_kv_asset_id uuid,
  out_selected_kv_candidate_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_kit_id uuid;
  v_asset_launch_kit_id uuid;
  v_asset_user_id uuid;
  v_asset_type text;
  v_asset_status text;
  v_candidate_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select id into v_kit_id
    from public.launch_kits
    where project_id = p_project_id and user_id = v_uid
    for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select launch_kit_id, user_id, asset_type, status, candidate_id
    into v_asset_launch_kit_id, v_asset_user_id, v_asset_type, v_asset_status, v_candidate_id
    from public.launch_assets
    where id = p_asset_id
    for update;

  if not found or v_asset_user_id <> v_uid then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_asset_launch_kit_id <> v_kit_id then
    raise exception 'asset_belongs_to_other_launch' using errcode = '22023';
  end if;
  if v_asset_type <> 'kv' then
    raise exception 'asset_not_kv' using errcode = '22023';
  end if;
  if v_asset_status <> 'done' then
    raise exception 'asset_not_ready' using errcode = '22023';
  end if;

  update public.launch_kits
    set selected_kv_asset_id = p_asset_id,
        selected_kv_candidate_id = v_candidate_id
    where id = v_kit_id;

  update public.launch_assets
    set selected_at = now()
    where id = p_asset_id;

  if v_candidate_id is not null then
    update public.kv_candidates
      set selected_at = now()
      where id = v_candidate_id;
  end if;

  return query select v_kit_id, p_project_id, p_asset_id, v_candidate_id;
end;
$$;
