-- Rodada 3 do redesenho do fluxo de KV: geração em lote + créditos reais.
--
-- Esta migration passou por uma rodada de revisão do Codex (gpt-5.6-sol)
-- que achou 6 problemas P1 na primeira versão. Reescrita do zero com as
-- correções — histórico de cada uma nos comentários abaixo.

-- ── 0. Endurecimento do livro-razão de créditos (generation_history) ─────
-- Achado P1 mais sério da revisão: a policy "history_owner" (init migration)
-- deixa o dono fazer UPDATE/DELETE em qualquer linha própria de
-- generation_history via o client normal — e a função legada
-- finalize_generation aceita qualquer p_id sem checar dono. Isso significa
-- que um usuário pode: (a) apagar a própria linha de crédito de um lote de
-- KV pra reduzir o SUM(cost) do mês e "recuperar" saldo, ou (b) chamar
-- finalize_generation direto com o id da própria reserva pendente de KV pra
-- marcá-la 'failed_refunded' ENQUANTO a geração de verdade ainda está
-- rodando — ganhando o reembolso e a imagem gerada ao mesmo tempo. Isso
-- também já era possível pro sistema de créditos legado antes desta
-- feature, mas documentar como "problema anterior" não protege a cobrança
-- nova — corrigido aqui:
--
--   1. Nova coluna generation_history.credit_locked: toda linha criada por
--      uma reserva de crédito real (legada ou de KV) marca credit_locked =
--      true. Linhas do recurso de "histórico visual" (src/app/lib/
--      history.ts, que insere direto do browser sem passar pela reserva)
--      continuam com o default false — esse recurso não é afetado.
--   2. A policy de UPDATE/DELETE do dono passa a exigir credit_locked =
--      false. Uma linha de crédito trancada só muda de estado através das
--      funções SECURITY DEFINER (que rodam como dono da tabela e ignoram
--      RLS de qualquer forma).
--   3. finalize_generation (legada) ganha duas travas: só mexe em linha do
--      próprio usuário (auth.uid()), e recusa qualquer linha com
--      gen_type = 'kv_batch' — essas só podem ser finalizadas por
--      finalize_kv_candidate, que tem o fencing de tentativa abaixo.
alter table public.generation_history
  add column if not exists credit_locked boolean not null default false;

-- Achado de revisão do Codex: mesmo com credit_locked, a policy de INSERT
-- (abaixo) deixa o dono inserir uma linha nova com cost negativo e
-- status='success' direto pelo client normal — isso reduz o SUM(cost) do
-- mês e infla o saldo disponível pra QUALQUER reserva (KV ou legada), já
-- que a soma nunca distingue "de onde veio" a linha. Uma constraint no
-- nível da tabela fecha isso pra qualquer caminho de escrita (INSERT direto
-- do client OU qualquer RPC, presente ou futura) — não é suficiente
-- confiar em "quem" escreve, o valor em si precisa ser válido sempre.
alter table public.generation_history
  drop constraint if exists generation_history_cost_non_negative;
alter table public.generation_history
  add constraint generation_history_cost_non_negative check (cost >= 0);

drop policy if exists "history_owner" on public.generation_history;

create policy "history_select_owner" on public.generation_history
  for select using (auth.uid() = user_id);

create policy "history_insert_owner" on public.generation_history
  for insert with check (auth.uid() = user_id);

create policy "history_update_owner_unlocked" on public.generation_history
  for update using (auth.uid() = user_id and credit_locked = false)
  with check (auth.uid() = user_id and credit_locked = false);

create policy "history_delete_owner_unlocked" on public.generation_history
  for delete using (auth.uid() = user_id and credit_locked = false);

-- claim_generation_credit (legada) passa a trancar toda reserva real.
create or replace function public.claim_generation_credit(
  p_user_id uuid,
  p_gen_type text,
  p_prompt text,
  p_limit int,
  p_cost int default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start timestamptz;
  v_used        int;
  v_id          uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  v_month_start := date_trunc('month', now());

  select coalesce(sum(cost), 0)
  into v_used
  from generation_history
  where user_id    = p_user_id
    and created_at >= v_month_start
    and status     in ('pending', 'success');

  if v_used + p_cost > p_limit then
    return jsonb_build_object('allowed', false, 'used', v_used, 'limit', p_limit);
  end if;

  insert into generation_history (user_id, prompt, platform, gen_type, code, status, cost, credit_locked)
  values (p_user_id, left(p_prompt, 500), 'html', p_gen_type, '', 'pending', p_cost, true)
  returning id into v_id;

  return jsonb_build_object(
    'allowed',       true,
    'generation_id', v_id::text,
    'used',          v_used + p_cost,
    'limit',         p_limit
  );
end;
$$;

-- finalize_generation (legada): recusa linhas de KV — essas passam
-- exclusivamente por finalize_kv_candidate (fencing próprio). Não checa
-- auth.uid() aqui: essa função (junto com claim_generation_credit) passou
-- a ser revogada de public/anon/authenticated na seção 9 mais abaixo — só
-- é chamável via client de service role a partir de src/app/lib/credits.ts,
-- que já resolveu a sessão de verdade antes de chegar aqui. auth.uid()
-- retornaria NULL numa chamada de service role (sem contexto de sessão),
-- então checar isso quebraria a única forma legítima de chamar esta
-- função agora que ela não é mais alcançável por um client hostil.
create or replace function public.finalize_generation(
  p_id      uuid,
  p_success boolean,
  p_error   text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update generation_history
  set
    status        = case when p_success then 'success' else 'failed_refunded' end,
    error_message = p_error
  where id = p_id
    and gen_type <> 'kv_batch';
end;
$$;

-- ── 1. launch_assets: coluna de controle de tentativa ────────────────────
-- attempt_id é o token de fencing — independente de generation_history_id
-- (que pode virar NULL via ON DELETE SET NULL quando o usuário apaga o
-- próprio histórico visual, e em modo dev/skip-credit é sempre NULL pra
-- toda tentativa, o que o tornava inútil como fencing — achado de revisão
-- do Codex). A idempotência de retry (client_attempt_id) vive numa tabela
-- própria (launch_asset_retry_attempts, seção 5) — não numa coluna aqui,
-- porque uma coluna só guarda a ÚLTIMA chave usada, e um reenvio tardio de
-- uma chave MAIS ANTIGA precisa continuar reconhecível mesmo depois de
-- retries genuínos mais novos terem acontecido (outro achado de revisão do
-- Codex).
alter table public.launch_assets
  add column if not exists attempt_id uuid not null default gen_random_uuid();

-- ── 2. Reap de tentativas abandonadas ────────────────────────────────────
-- Corrigido: (a) agora reconcilia 'pending' também, não só 'generating' —
-- se o processo morre ANTES de sequer chamar acquire_kv_attempt, esses
-- candidatos ficavam presos pra sempre (não existia caminho de saída: o
-- lote já tinha created=true, e retry só aceita status='error'); (b) ordem
-- de lock trocada — trava launch_assets primeiro (mesma ordem de
-- finalize_kv_candidate), só depois mexe em generation_history, evitando o
-- deadlock cruzado que a versão anterior tinha (reap trava histórico
-- primeiro e espera candidato; finalize trava candidato primeiro e espera
-- histórico — duas transações concorrentes podiam abortar uma à outra).
create or replace function public.reap_stale_kv_generations(
  p_user_id uuid,
  p_timeout interval default interval '3 minutes'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if p_user_id is null then
    return;
  end if;

  -- Toma o lock aqui (não só nos chamadores) — reap é chamado direto pelo
  -- GET do lote também, que não tinha nenhum lock antes (achado de revisão
  -- do Codex). pg_advisory_xact_lock é reentrante dentro da mesma
  -- transação, então claim_kv_batch/claim_kv_candidate_retry chamarem de
  -- novo antes disso não gera deadlock consigo mesmas.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  for r in
    select id, generation_history_id
    from public.launch_assets
    where user_id = p_user_id
      and status in ('pending', 'generating')
      and updated_at < now() - p_timeout
    order by id
    for update
  loop
    if r.generation_history_id is not null then
      update public.generation_history
        set status = 'failed_refunded',
            error_message = coalesce(error_message, 'Tempo esgotado (tentativa abandonada).')
        where id = r.generation_history_id and status = 'pending';
    end if;

    update public.launch_assets
      set status = 'error', error_code = 'timeout', error_message = 'Tempo esgotado — tente novamente.'
      where id = r.id;
  end loop;
end;
$$;

revoke all on function public.reap_stale_kv_generations(uuid, interval) from public, anon, authenticated;

-- ── 3. Reserva + criação transacional do lote ────────────────────────────
-- p_directions/p_prompts andam em paralelo (mesmo índice = mesmo
-- candidato); o prompt já vem pronto do TypeScript (buildLogoPrompt) — esta
-- função só persiste, nunca constrói texto de prompt. Candidatos nascem
-- 'pending' — a transição pra 'generating' (com um attempt_id de verdade)
-- só acontece via acquire_kv_attempt, chamado pelo worker depois.
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
  v_hid uuid;
  v_aid uuid;
  i int;
begin
  if p_user_id is null then
    raise exception 'user_id_required' using errcode = '22023';
  end if;
  -- coalesce(array_length(...), 0): array_length de um array VAZIO (não
  -- nulo) também retorna NULL em Postgres — comparar direto com <> deixava
  -- passar p_prompts = '{}' silenciosamente (NULL <> N avalia NULL, que
  -- 'if' trata como falso, não como erro) — achado de revisão do Codex.
  v_count := coalesce(array_length(p_directions, 1), 0);
  if v_count = 0 or coalesce(array_length(p_prompts, 1), 0) <> v_count then
    raise exception 'invalid_batch_shape' using errcode = '22023';
  end if;

  -- Lock por usuário ANTES do reap (não depois) — toda operação que afeta
  -- o saldo deste usuário (criação de lote, retry, e o reap que elas mesmas
  -- disparam) fica serializada por essa mesma chave, ponta a ponta.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  perform public.reap_stale_kv_generations(p_user_id);

  select user_id into v_owner from public.launch_kits where id = p_launch_kit_id;
  if v_owner is null or v_owner <> p_user_id then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- Idempotência: já existe um lote com esse client_batch_id pra esse
  -- lançamento? Retorna ele como está, sem reservar de novo. Mesma chave
  -- com config diferente (DNA/provider/model mudou) é erro, não reuso
  -- silencioso.
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
    v_hid := null;
    if not p_skip_credit_check then
      insert into public.generation_history (user_id, prompt, platform, gen_type, code, status, cost, credit_locked)
        values (p_user_id, left(p_prompts[i], 500), 'html', p_gen_type, '', 'pending', p_cost_per_item, true)
        returning id into v_hid;
    end if;

    insert into public.launch_assets (
      user_id, launch_kit_id, asset_type, batch_id, position, status,
      variation_key, prompt_snapshot, generation_config, generation_history_id
    ) values (
      p_user_id, p_launch_kit_id, p_asset_type, p_client_batch_id, i - 1, 'pending',
      p_directions[i], p_prompts[i], p_generation_config, v_hid
    ) returning id into v_aid;

    v_asset_ids := v_asset_ids || v_aid;
  end loop;

  return jsonb_build_object(
    'created', true, 'allowed', true,
    'launch_kit_id', p_launch_kit_id, 'batch_id', p_client_batch_id,
    'asset_ids', v_asset_ids, 'used', v_used + v_required, 'limit', p_limit
  );
end;
$$;

revoke all on function public.claim_kv_batch(uuid, uuid, uuid, text, text, text[], text[], jsonb, int, int, boolean)
  from public, anon, authenticated;

-- ── 4. Aquisição atômica de UMA tentativa (candidato 'pending') ──────────
-- Substitui o UPDATE solto sem checagem de erro/linhas afetadas que a
-- rota de lote fazia antes de chamar a IA — achado de revisão do Codex
-- ("o worker inicia IA mesmo sem confirmar aquisição"). Gera um attempt_id
-- novo, que vira o token de fencing usado por finalize_kv_candidate e no
-- caminho do Storage.
create or replace function public.acquire_kv_attempt(
  p_user_id uuid,
  p_launch_kit_id uuid,
  p_asset_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_launch_kit_id uuid;
  v_status text;
  v_hid uuid;
  v_attempt uuid;
begin
  if p_user_id is null then
    raise exception 'user_id_required' using errcode = '22023';
  end if;

  select user_id, launch_kit_id, status, generation_history_id
    into v_owner, v_launch_kit_id, v_status, v_hid
    from public.launch_assets
    where id = p_asset_id
    for update;

  if v_owner is null or v_owner <> p_user_id then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_launch_kit_id <> p_launch_kit_id then
    raise exception 'asset_belongs_to_other_launch' using errcode = '22023';
  end if;
  if v_status <> 'pending' then
    raise exception 'not_acquirable' using errcode = '22023';
  end if;

  v_attempt := gen_random_uuid();
  update public.launch_assets
    set status = 'generating', attempt_id = v_attempt
    where id = p_asset_id;

  -- generation_history_id devolvido junto — foi setado no INSERT do
  -- claim_kv_batch e nunca muda pra este candidato até um eventual retry
  -- (que minera o seu próprio). O caller precisa dele pra passar de volta
  -- pra finalize_kv_candidate como "a reserva que ESTA tentativa é dona",
  -- em vez de finalize_kv_candidate ler isso da linha (que pode já ter
  -- mudado por uma tentativa mais nova quando a resposta chegar) — achado
  -- de revisão do Codex (reembolso ia pro crédito errado nesse caso).
  return jsonb_build_object('attempt_id', v_attempt, 'generation_history_id', v_hid);
end;
$$;

revoke all on function public.acquire_kv_attempt(uuid, uuid, uuid) from public, anon, authenticated;

-- Tabela de idempotência de retry: cada (asset_id, client_attempt_id) só é
-- consumida UMA vez, pra sempre — não é "a última chave usada" (que
-- launch_assets.client_attempt_id representava antes). Achado de revisão
-- do Codex: guardar só a última chave deixa um reenvio tardio de uma chave
-- MAIS ANTIGA (ex: rede perdeu a resposta do 1º retry, cliente reenviou a
-- MESMA chave — o cenário exato que a idempotência deveria cobrir) cair
-- fora do "replay" assim que um 2º retry (com chave diferente) sobrescreve
-- o campo — o reenvio da 1ª chave então dispara uma tentativa nova em vez
-- de devolver o resultado da 1ª. Com uma linha permanente por chave, QUALQUER
-- reenvio de QUALQUER chave já usada devolve o mesmo resultado, pra sempre,
-- não importa quantos retries genuínos aconteceram depois.
create table if not exists public.launch_asset_retry_attempts (
  asset_id uuid not null references public.launch_assets(id) on delete cascade,
  client_attempt_id uuid not null,
  attempt_id uuid not null,
  generation_history_id uuid,
  created_at timestamptz not null default now(),
  primary key (asset_id, client_attempt_id)
);

alter table public.launch_asset_retry_attempts enable row level security;
-- Sem nenhuma policy de dono — só as funções SECURITY DEFINER abaixo
-- tocam essa tabela. RLS habilitada + zero policies = ninguém além do
-- dono da tabela (que os SECURITY DEFINER assumem) lê ou escreve aqui.

-- ── 5. Retry de UM candidato — aquisição atômica + idempotência ──────────
-- Trava a linha, confirma status='error', reserva o crédito e já troca
-- error->generating + gera um attempt_id e generation_history_id novos,
-- tudo na mesma transação. Uma segunda request de retry concorrente pro
-- mesmo candidato bloqueia no FOR UPDATE e, ao destravar, vê
-- status='generating' — rejeitada com not_retryable.
--
-- p_client_attempt_id é a chave de idempotência enviada pelo cliente:
-- "mesma chave = mesma tentativa, pra sempre" — mesmo que a tentativa já
-- tenha terminado em erro (uma tentativa NOVA de verdade exige uma chave
-- NOVA do cliente; reenviar a mesma chave nunca reserva crédito de novo,
-- reenviar a mesma chave depois de já ter dado erro também não conta como
-- pedido de tentar de novo — achado de revisão do Codex, minha primeira
-- versão só tratava como replay enquanto o candidato ainda não tivesse
-- voltado a 'error', o que reabria exatamente o buraco que a idempotência
-- deveria fechar).
create or replace function public.claim_kv_candidate_retry(
  p_user_id uuid,
  p_launch_kit_id uuid,
  p_asset_id uuid,
  p_client_attempt_id uuid,
  p_gen_type text,
  p_cost int,
  p_limit int,
  p_prompt text,
  p_skip_credit_check boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_launch_kit_id uuid;
  v_status text;
  v_existing_attempt uuid;
  v_existing_hid uuid;
  v_month_start timestamptz;
  v_used int := 0;
  v_hid uuid;
  v_attempt uuid;
begin
  if p_user_id is null then
    raise exception 'user_id_required' using errcode = '22023';
  end if;
  if p_client_attempt_id is null then
    raise exception 'client_attempt_id_required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  perform public.reap_stale_kv_generations(p_user_id);

  select user_id, launch_kit_id, status
    into v_owner, v_launch_kit_id, v_status
    from public.launch_assets
    where id = p_asset_id
    for update;

  if v_owner is null or v_owner <> p_user_id then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_launch_kit_id <> p_launch_kit_id then
    raise exception 'asset_belongs_to_other_launch' using errcode = '22023';
  end if;

  -- Replay: essa client_attempt_id já foi usada antes pra esse candidato —
  -- devolve o resultado registrado, nunca reserva crédito de novo.
  select attempt_id, generation_history_id
    into v_existing_attempt, v_existing_hid
    from public.launch_asset_retry_attempts
    where asset_id = p_asset_id and client_attempt_id = p_client_attempt_id;

  if found then
    return jsonb_build_object(
      'allowed', true, 'replay', true,
      'attempt_id', v_existing_attempt, 'generation_history_id', v_existing_hid
    );
  end if;

  if v_status <> 'error' then
    raise exception 'not_retryable' using errcode = '22023';
  end if;

  if not p_skip_credit_check then
    v_month_start := date_trunc('month', now());
    select coalesce(sum(cost), 0) into v_used
      from public.generation_history
      where user_id = p_user_id and created_at >= v_month_start and status in ('pending', 'success');

    if v_used + p_cost > p_limit then
      return jsonb_build_object('allowed', false, 'used', v_used, 'limit', p_limit, 'required', p_cost);
    end if;

    insert into public.generation_history (user_id, prompt, platform, gen_type, code, status, cost, credit_locked)
      values (p_user_id, left(p_prompt, 500), 'html', p_gen_type, '', 'pending', p_cost, true)
      returning id into v_hid;
  end if;

  v_attempt := gen_random_uuid();
  update public.launch_assets
    set status = 'generating', generation_history_id = v_hid, attempt_id = v_attempt,
        error_code = null, error_message = null
    where id = p_asset_id;

  insert into public.launch_asset_retry_attempts (asset_id, client_attempt_id, attempt_id, generation_history_id)
    values (p_asset_id, p_client_attempt_id, v_attempt, v_hid);

  return jsonb_build_object(
    'allowed', true, 'replay', false, 'attempt_id', v_attempt, 'generation_history_id', v_hid,
    'used', v_used + case when p_skip_credit_check then 0 else p_cost end, 'limit', p_limit
  );
end;
$$;

revoke all on function public.claim_kv_candidate_retry(uuid, uuid, uuid, uuid, text, int, int, text, boolean)
  from public, anon, authenticated;

-- ── 6. Finalização com fencing de tentativa (3 resultados possíveis) ─────
-- Reescrita per revisão do Codex: a versão anterior confundia "tentativa
-- obsoleta" com "replay da MESMA tentativa já concluída", e podia gravar
-- 'success' (cobrando o crédito) numa tentativa que na verdade tinha sido
-- descartada. Agora o fencing usa attempt_id (não mais
-- generation_history_id, que pode virar NULL ao apagar histórico e é
-- sempre NULL em dev — inútil como token) e distingue 3 casos:
--
--   'applied'         — primeira finalização desta tentativa, aplicada.
--   'already_applied' — replay da MESMA tentativa com o MESMO resultado
--                        (ex: rede caiu depois do commit, worker tentou de
--                        novo) — idempotente, NÃO reembolsa nem recobra.
--   'stale'           — uma tentativa mais nova já assumiu o candidato —
--                        nunca aplica o resultado, SEMPRE reembolsa (nunca
--                        cobra) a reserva desta tentativa descartada, seja
--                        p_success true ou false.
--   'conflict'         — mesmo attempt_id, mas o resultado pedido agora não
--                        bate com o que já está gravado (não deveria
--                        acontecer nunca; defensivo).
--
-- Só o caller pode decidir com segurança quando apagar o upload órfão: só
-- em 'stale' há prova de que este upload nunca foi (e nunca será) o
-- arquivo do candidato. Em 'already_applied' o upload É o arquivo
-- canônico — apagá-lo destruiria o resultado de verdade.
--
-- p_generation_history_id é passado explicitamente pelo caller (devolvido
-- por acquire_kv_attempt/claim_kv_candidate_retry no momento da aquisição)
-- em vez de lido da linha aqui dentro — achado de revisão do Codex: ler da
-- linha significa ler o generation_history_id ATUAL, que numa tentativa
-- obsoleta já pertence à tentativa NOVA que a substituiu. Isso fazia o
-- ramo 'stale' reembolsar o crédito da tentativa errada (a nova, que
-- talvez ainda esteja rodando ou já tenha terminado com sucesso).
create or replace function public.finalize_kv_candidate(
  p_user_id uuid,
  p_asset_id uuid,
  p_attempt_id uuid,
  p_generation_history_id uuid,
  p_success boolean,
  p_storage_bucket text default null,
  p_storage_path text default null,
  p_mime_type text default null,
  p_width int default null,
  p_height int default null,
  p_error_code text default null,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_current_attempt uuid;
  v_current_status text;
  v_current_storage_path text;
begin
  if p_user_id is null then
    raise exception 'user_id_required' using errcode = '22023';
  end if;

  select user_id, attempt_id, status, storage_path
    into v_owner, v_current_attempt, v_current_status, v_current_storage_path
    from public.launch_assets
    where id = p_asset_id
    for update;

  if v_owner is null or v_owner <> p_user_id then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if v_current_attempt is distinct from p_attempt_id then
    -- Tentativa obsoleta — sempre reembolsa a RESERVA DESTA TENTATIVA
    -- (p_generation_history_id, nunca a que está atualmente na linha), e
    -- nunca marca 'success', mesmo que p_success seja true: o trabalho
    -- desta tentativa foi descartado, não entregou valor nenhum ao
    -- usuário.
    if p_generation_history_id is not null then
      update public.generation_history
        set status = 'failed_refunded',
            error_message = coalesce(p_error_message, 'Tentativa substituída por uma mais nova.')
        where id = p_generation_history_id and user_id = p_user_id and status = 'pending';
    end if;
    return jsonb_build_object('status', 'stale');
  end if;

  if v_current_status <> 'generating' then
    -- Mesmo attempt_id, candidato já não está mais 'generating' — só pode
    -- ser replay da MESMA finalização (idempotente) ou um conflito real.
    if p_success and v_current_status = 'done' and v_current_storage_path = p_storage_path then
      return jsonb_build_object('status', 'already_applied');
    end if;
    if not p_success and v_current_status = 'error' then
      return jsonb_build_object('status', 'already_applied');
    end if;
    return jsonb_build_object('status', 'conflict');
  end if;

  if p_success then
    update public.launch_assets
      set status = 'done',
          storage_bucket = p_storage_bucket,
          storage_path = p_storage_path,
          mime_type = p_mime_type,
          width = p_width,
          height = p_height,
          error_code = null,
          error_message = null
      where id = p_asset_id;
  else
    update public.launch_assets
      set status = 'error',
          error_code = p_error_code,
          error_message = coalesce(p_error_message, 'Erro desconhecido.')
      where id = p_asset_id;
  end if;

  if p_generation_history_id is not null then
    update public.generation_history
      set status = case when p_success then 'success' else 'failed_refunded' end,
          error_message = p_error_message
      where id = p_generation_history_id and user_id = p_user_id and status = 'pending';
  end if;

  return jsonb_build_object('status', 'applied');
end;
$$;

revoke all on function public.finalize_kv_candidate(uuid, uuid, uuid, uuid, boolean, text, text, text, int, int, text, text)
  from public, anon, authenticated;

-- ── 7. select_launch_kv precisa virar SECURITY DEFINER ───────────────────
-- Mesma lógica da Rodada 1, sem nenhuma mudança de comportamento — só passa
-- a rodar com privilégio elevado, porque a policy de UPDATE que ela
-- dependia (launch_assets_owner "FOR ALL") está sendo removida abaixo. As
-- checagens de dono/tipo/status já embutidas na função continuam sendo a
-- única coisa que autoriza a escrita, exatamente como antes.
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

  update public.launch_assets
    set selected_at = now()
    where id = p_asset_id;

  return query select v_kit_id, p_project_id, p_asset_id;
end;
$$;

-- ── 8. launch_assets: dono só lê, escreve só via função ──────────────────
drop policy if exists "launch_assets_owner" on public.launch_assets;

drop policy if exists "launch_assets_select_owner" on public.launch_assets;
create policy "launch_assets_select_owner" on public.launch_assets
  for select using (auth.uid() = user_id);

-- ── 9. Fecha a RPC legada de créditos ─────────────────────────────────────
-- Achado P1 da revisão do Codex, e ele tem razão em não deixar isso pra
-- depois: claim_generation_credit continuava concedida a "authenticated" e
-- aceitando p_user_id/p_limit/p_cost como parâmetros confiáveis — ou seja,
-- qualquer client autenticado podia chamar essa RPC direto (via
-- supabase.rpc, sem passar pela rota nenhuma) informando o UUID de OUTRO
-- usuário, um p_cost alto e um p_limit inflado. Isso cria, no saldo da
-- VÍTIMA, uma reserva credit_locked=true (com o endurecimento desta mesma
-- migration) com gen_type='kv_batch' — que a finalização legada recusa
-- tocar (endurecimento também desta migration) e que o reap de KV nunca
-- alcança (ele só reconcilia via linha de launch_assets, e essa reserva
-- forjada não tem nenhuma). Resultado: uma trava permanente e irreversível
-- no saldo mensal de qualquer usuário, sem exigir nada além de um UUID
-- alheio.
--
-- Correção: revoga a execução pública de claim_generation_credit e
-- finalize_generation. src/app/lib/credits.ts é o ÚNICO chamador dessas
-- duas funções em todo o app (confirmado por busca no código) — não expõe
-- nenhuma rota nova nem muda o comportamento de nenhum caller existente,
-- só troca o client usado internamente por essas duas chamadas específicas
-- pra um client de service role, mantendo autenticação e resolução de
-- plano/limite no client de sessão normal como já era.
revoke all on function public.claim_generation_credit(uuid, text, text, int, int) from public, anon, authenticated;
revoke all on function public.finalize_generation(uuid, boolean, text) from public, anon, authenticated;

-- ── 10. Nota pré-deploy: reservas anteriores a esta migration ────────────
-- credit_locked nasce com default false (seção 0) — qualquer linha de
-- generation_history que já existisse ANTES desta migration rodar fica
-- destravada (editável/apagável pelo dono), mesmo representando uma reserva
-- de crédito real, porque o default não diferencia "reserva real antiga"
-- de "linha do histórico visual antiga" (mesma tabela, mesmo formato).
--
-- Verificado nesta sessão: o ambiente local usado pra testar esta migration
-- tinha generation_history vazia no momento da aplicação — não há dado
-- histórico real em risco aqui. NUNCA foi aplicada em produção (nada deste
-- trabalho foi commitado ainda).
--
-- Antes de aplicar esta migration em qualquer ambiente com dado histórico
-- real (staging com dados reais, produção): auditar manualmente as linhas
-- de generation_history existentes e decidir como travar as que
-- representam reservas de crédito reais, sem travar por engano as do
-- recurso de histórico visual (src/app/lib/history.ts) — não dá pra
-- automatizar esse backfill com segurança sem ver os dados de verdade
-- (achado de revisão do Codex).

-- ── 11. user_profiles: dono não pode mais escrever o próprio plano ──────
-- Achado P1 da revisão do Codex: fechei o REVOKE das RPCs de crédito e a
-- origem do p_limit continuava sendo user_profiles.plan — mas as policies
-- de INSERT/UPDATE de user_profiles (migration 20260429000000) deixam o
-- dono escrever a PRÓPRIA linha sem nenhuma restrição sobre o valor de
-- plan. Ou seja, um usuário Free podia fazer UPDATE direto (via PostgREST,
-- sem precisar de nenhuma RPC) pra plan='scale', e daí resolvePlanLimit
-- (chamado do lado do servidor, mas lendo um valor que o próprio client
-- escreveu) passava a resolver um limite mensal bem maior — "resolver no
-- servidor" não torna confiável um campo que o client pode editar direto.
--
-- Busquei no código: NENHUMA rota do app hoje faz INSERT/UPDATE em
-- user_profiles pelo client — usage/route.ts, credits/route.ts e
-- credits.ts só fazem SELECT (e caem pro plano 'free' via DEFAULT_PLAN
-- quando não existe linha nenhuma). As duas policies de escrita nunca
-- foram usadas por nenhuma feature real — dá pra removê-las sem quebrar
-- nada. A única escrita legítima de plan é o endpoint administrativo
-- (/api/admin/set-plan, protegido por ADMIN_SECRET), que passa a usar um
-- client de service role (fora desta migration, em código) — não depende
-- mais de RLS pra funcionar em nome de outro usuário.
drop policy if exists "Users can insert own profile" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;
