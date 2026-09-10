-- Rodada 1 do redesenho do fluxo de KV (key visual): persistência, sem IA.
--
-- Hoje a geração de KV (BrandIdentityPage → /api/generate-logo) produz UMA
-- imagem por chamada e não persiste nada (só download local) — se o KV sair
-- ruim, contamina tudo que vem depois (criativos/carrossel/páginas), porque
-- o resto do lançamento é construído em cima dele. O novo fluxo gera vários
-- candidatos por lote e manda o usuário pra uma tela de seleção; só o
-- escolhido vira o KV oficial do lançamento.
--
-- launch_assets é modelada como uma tabela genérica de "ativos gerados por
-- lançamento" para poder ser reaproveitada por Criativos/Carrossel/Páginas
-- mais adiante (spec do Codex, gpt-5.6-sol, sessão 2026-09-09), mas nesta
-- rodada só habilitamos asset_type = 'kv'. Geração via IA em lote entra numa
-- rodada seguinte — esta migration só cria a persistência (tabela + coluna +
-- RLS + triggers + RPC de seleção), sem tocar em créditos/geração.

create table if not exists public.launch_assets (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  launch_kit_id         uuid not null references public.launch_kits(id) on delete cascade,
  asset_type            text not null check (asset_type in ('kv')),
  batch_id              uuid not null,
  position              int not null check (position >= 0),
  status                text not null default 'pending' check (status in ('pending', 'generating', 'done', 'error')),
  storage_bucket        text,
  storage_path          text,
  mime_type             text,
  width                 int,
  height                int,
  variant               text check (variant in ('dark', 'light')),
  variation_key         text,
  prompt_snapshot       text,
  generation_config     jsonb not null default '{}'::jsonb,
  generation_history_id uuid references public.generation_history(id) on delete set null,
  error_code            text,
  error_message         text,
  selected_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint launch_assets_done_has_file check (
    status <> 'done'
    or (
      storage_bucket is not null and btrim(storage_bucket) <> ''
      and storage_path is not null and btrim(storage_path) <> ''
      and mime_type is not null and mime_type in ('image/png', 'image/jpeg', 'image/webp')
      and width is not null and width > 0
      and height is not null and height > 0
    )
  ),
  constraint launch_assets_error_has_reason check (
    status <> 'error'
    or (
      (error_code is not null and btrim(error_code) <> '')
      or (error_message is not null and btrim(error_message) <> '')
    )
  )
);

create unique index if not exists launch_assets_batch_position_key
  on public.launch_assets(batch_id, position);

create index if not exists launch_assets_launch_kit_type_idx
  on public.launch_assets(launch_kit_id, asset_type, created_at desc);

create index if not exists launch_assets_batch_id_idx
  on public.launch_assets(batch_id);

alter table public.launch_assets enable row level security;

create policy "launch_assets_owner" on public.launch_assets
  for all using (auth.uid() = user_id);

create or replace trigger launch_assets_updated_at
  before update on public.launch_assets
  for each row execute procedure public.set_updated_at();

-- Ownership consistency: launch_assets.user_id must match launch_kits.user_id
-- (mesmo padrão de enforce_launch_kit_owner em 20260908000000_launches_p0.sql).
-- Também valida generation_history_id quando presente: uma FK só garante que
-- a linha existe, não que pertence ao mesmo usuário — sem essa checagem, o
-- dono do candidato poderia vincular o histórico (e crédito) de outra pessoa
-- ao seu próprio ativo (achado de revisão do Codex, gpt-5.6-sol).
create or replace function public.enforce_launch_asset_owner()
returns trigger language plpgsql as $$
declare
  v_owner uuid;
  v_history_owner uuid;
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

  return new;
end;
$$;

drop trigger if exists launch_assets_owner_consistency on public.launch_assets;
create trigger launch_assets_owner_consistency
  before insert or update on public.launch_assets
  for each row execute procedure public.enforce_launch_asset_owner();

-- Imutabilidade pós-criação: um candidato pertence a um único
-- lote/lançamento/posição/identidade pra sempre (id, created_at inclusos —
-- updated_at continua mudando via set_updated_at, isso é esperado). Uma vez
-- 'done', nenhum dado de arquivo pode mais mudar — só selected_at continua
-- editável. Sem isso, dava pra invalidar em silêncio o KV que um lançamento
-- já tinha escolhido (ex: rebaixar o candidato selecionado de volta pra
-- 'pending', ou movê-lo pra outro lançamento) — achado de revisão do Codex
-- (gpt-5.6-sol).
--
-- 'error' (ao contrário de 'done') fica de fora do bloqueio de status/dados:
-- a Rodada 3 (retry) precisa poder reescrever o mesmo candidato de volta pra
-- 'pending'/'generating' em vez de criar uma linha nova (que colidiria com
-- unique(batch_id, position)) — outro ponto que o Codex também sinalizou.
--
-- generation_history_id é a exceção dentro de 'done': ele só pode ir de um
-- valor não-nulo para NULL (nunca trocar de um id não-nulo pra outro) — isso
-- é exatamente a transição que o ON DELETE SET NULL da FK dispara quando o
-- usuário limpa o próprio histórico de gerações (src/app/lib/history.ts).
-- Bloquear qualquer mudança nesse campo, como a primeira versão desta
-- trigger fazia, quebraria essa função existente sempre que o histórico
-- apagado estivesse ligado a um KV já concluído.
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

drop trigger if exists launch_assets_immutability on public.launch_assets;
create trigger launch_assets_immutability
  before update on public.launch_assets
  for each row execute procedure public.enforce_launch_asset_immutability();

-- ── launch_kits.selected_kv_asset_id ────────────────────────────────────
-- Aponta pro candidato de KV aprovado deste lançamento. Fica separado de
-- brand_identity (que guarda conceito/cores/fontes/logo estruturado) — são
-- dois conceitos diferentes de "identidade" e não devem ser misturados.
alter table public.launch_kits
  add column if not exists selected_kv_asset_id uuid references public.launch_assets(id) on delete set null;

-- Só pode apontar pra um ativo do tipo 'kv', já concluído ('done'), do mesmo
-- lançamento e do mesmo dono — nunca de outro lançamento/usuário.
create or replace function public.enforce_selected_kv_asset()
returns trigger language plpgsql as $$
declare
  v_launch_kit_id uuid;
  v_user_id uuid;
  v_asset_type text;
  v_status text;
begin
  if new.selected_kv_asset_id is null then
    return new;
  end if;

  select launch_kit_id, user_id, asset_type, status
    into v_launch_kit_id, v_user_id, v_asset_type, v_status
    from public.launch_assets
    where id = new.selected_kv_asset_id;

  if not found then
    raise exception 'selected_kv_asset_id references a nonexistent launch_asset';
  end if;
  if v_launch_kit_id <> new.id then
    raise exception 'selected_kv_asset_id must belong to the same launch_kit';
  end if;
  if v_user_id <> new.user_id then
    raise exception 'selected_kv_asset_id must belong to the same owner';
  end if;
  if v_asset_type <> 'kv' then
    raise exception 'selected_kv_asset_id must reference a kv asset';
  end if;
  if v_status <> 'done' then
    raise exception 'selected_kv_asset_id must reference a completed (done) asset';
  end if;

  return new;
end;
$$;

drop trigger if exists launch_kits_selected_kv_asset_consistency on public.launch_kits;
create trigger launch_kits_selected_kv_asset_consistency
  before insert or update on public.launch_kits
  for each row execute procedure public.enforce_selected_kv_asset();

-- ── select_launch_kv: RPC transacional dedicada pra aprovar um candidato.
--    Não reaproveita save_launch — essa operação tem invariantes próprias e
--    mexe em duas tabelas (launch_kits + launch_assets). Roda como o usuário
--    chamador (sem SECURITY DEFINER), então as policies de RLS de
--    launch_kits/launch_assets continuam valendo nos updates abaixo.
create or replace function public.select_launch_kv(
  p_project_id uuid,
  p_asset_id uuid
)
returns table (
  out_launch_kit_id uuid,
  out_project_id uuid,
  out_selected_kv_asset_id uuid
)
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_kit_id uuid;
  v_asset_launch_kit_id uuid;
  v_asset_user_id uuid;
  v_asset_type text;
  v_asset_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Trava a linha de launch_kits pelo resto da transação, pra uma seleção
  -- concorrente (ex: duas abas) não passar pelas checagens abaixo em paralelo.
  select id into v_kit_id
    from public.launch_kits
    where project_id = p_project_id and user_id = v_uid
    for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select launch_kit_id, user_id, asset_type, status
    into v_asset_launch_kit_id, v_asset_user_id, v_asset_type, v_asset_status
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
    set selected_kv_asset_id = p_asset_id
    where id = v_kit_id;

  -- selected_at guarda só a data da seleção mais recente deste candidato —
  -- não é um histórico completo de todas as vezes que ele já foi escolhido
  -- (trocar e voltar pro mesmo candidato reescreve o valor).
  update public.launch_assets
    set selected_at = now()
    where id = p_asset_id;

  return query select v_kit_id, p_project_id, p_asset_id;
end;
$$;
