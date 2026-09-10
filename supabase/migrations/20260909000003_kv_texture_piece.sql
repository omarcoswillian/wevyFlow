-- Rodada D do redesenho de KV (spec do Codex, gpt-5.6-sol): primeira peça
-- COMPOSTA que também é gerada por IA de verdade (textura de fundo) — as
-- peças da Rodada B (paleta, tipografia) são só renderização, sem custo.
-- Diferente do logo (reservado todo de uma vez em claim_kv_batch, porque as
-- 4 direções são elegíveis desde o início do lote), a textura só fica
-- elegível DEPOIS que o logo daquele candidato terminar (precisa da paleta
-- extraída dele) — exatamente o caso que motivou a "reserva por etapa
-- elegível" do spec do Codex (seção 4.3): reservar o crédito só quando a
-- peça realmente pode começar, não tudo de uma vez na criação do lote.
--
-- claim_kv_piece generaliza esse "adicionar uma peça nova a um candidato
-- já existente, com sua própria reserva" pra qualquer peça futura (não só
-- textura) — segue exatamente o mesmo padrão de claim_kv_candidate_retry
-- (trava por usuário, reap, idempotência), só que cria uma peça NOVA em vez
-- de reabrir uma que já existe e falhou.

drop function if exists public.claim_kv_piece(uuid, uuid, uuid, text, text, text, int, text, text, int, int, boolean);

create or replace function public.claim_kv_piece(
  p_user_id uuid,
  p_launch_kit_id uuid,
  p_candidate_id uuid,
  p_piece_key text,
  p_asset_role text,
  p_producer text,
  p_position int,
  p_gen_type text,
  p_prompt text,
  p_generation_config jsonb,
  p_cost int,
  p_limit int,
  p_skip_credit_check boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_owner uuid;
  v_candidate_launch_kit_id uuid;
  v_candidate_batch_id uuid;
  v_existing_id uuid;
  v_month_start timestamptz;
  v_used int := 0;
  v_hid uuid;
  v_aid uuid;
begin
  if p_user_id is null then
    raise exception 'user_id_required' using errcode = '22023';
  end if;
  if p_producer not in ('image_ai', 'renderer') then
    raise exception 'invalid_producer' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  perform public.reap_stale_kv_generations(p_user_id);

  select user_id, launch_kit_id, batch_id
    into v_candidate_owner, v_candidate_launch_kit_id, v_candidate_batch_id
    from public.kv_candidates
    where id = p_candidate_id
    for update;

  if v_candidate_owner is null or v_candidate_owner <> p_user_id then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_candidate_launch_kit_id <> p_launch_kit_id then
    raise exception 'candidate_belongs_to_other_launch' using errcode = '22023';
  end if;

  -- Idempotente: essa peça já existe pra esse candidato? Devolve ela sem
  -- reservar crédito de novo — acontece quando o enriquecimento que chama
  -- isto roda mais de uma vez pro mesmo candidato (replay de finalize do
  -- logo, ex: 'already_applied' depois de uma resposta de rede ambígua).
  select id into v_existing_id
    from public.launch_assets
    where candidate_id = p_candidate_id and piece_key = p_piece_key;

  if found then
    return jsonb_build_object('allowed', true, 'created', false, 'asset_id', v_existing_id);
  end if;

  if not p_skip_credit_check then
    v_month_start := date_trunc('month', now());
    select coalesce(sum(cost), 0) into v_used
      from public.generation_history
      where user_id = p_user_id and created_at >= v_month_start and status in ('pending', 'success');

    if v_used + p_cost > p_limit then
      return jsonb_build_object('allowed', false, 'created', false, 'used', v_used, 'limit', p_limit, 'required', p_cost);
    end if;

    insert into public.generation_history (user_id, prompt, platform, gen_type, code, status, cost, credit_locked)
      values (p_user_id, left(p_prompt, 500), 'html', p_gen_type, '', 'pending', p_cost, true)
      returning id into v_hid;
  end if;

  insert into public.launch_assets (
    user_id, launch_kit_id, asset_type, batch_id, position, status,
    prompt_snapshot, generation_config, generation_history_id, candidate_id, piece_key, asset_role, producer
  ) values (
    p_user_id, p_launch_kit_id, 'kv', v_candidate_batch_id, p_position, 'pending',
    p_prompt, coalesce(p_generation_config, '{}'::jsonb), v_hid, p_candidate_id, p_piece_key, p_asset_role, p_producer
  ) returning id into v_aid;

  return jsonb_build_object(
    'allowed', true, 'created', true, 'asset_id', v_aid,
    'used', v_used + case when p_skip_credit_check then 0 else p_cost end, 'limit', p_limit
  );
end;
$$;

revoke all on function public.claim_kv_piece(uuid, uuid, uuid, text, text, text, int, text, text, jsonb, int, int, boolean)
  from public, anon, authenticated;
