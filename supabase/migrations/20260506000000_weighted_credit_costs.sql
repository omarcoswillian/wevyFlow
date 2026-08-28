-- ================================================================
-- WevyFlow: weighted credit costs per action type.
--
-- Until now every generation (a cheap HTML edit or an expensive Nano
-- Banana Pro image) consumed exactly 1 "credit", so a plan's monthly
-- limit didn't reflect real API cost at all. This adds a per-row `cost`
-- and switches the atomic claim/usage math from COUNT(*) to SUM(cost) —
-- the actual weight for each action type lives in src/app/lib/credits.ts.
-- Execute no painel SQL do Supabase
-- ================================================================

alter table public.generation_history
  add column if not exists cost int not null default 1;

-- Must DROP first: adding a parameter changes the function's signature, so
-- CREATE OR REPLACE would create a second overload instead of replacing it,
-- and a 4-arg call would then be ambiguous between the two.
DROP FUNCTION IF EXISTS public.claim_generation_credit(uuid, text, text, int);

CREATE OR REPLACE FUNCTION public.claim_generation_credit(
  p_user_id uuid,
  p_gen_type text,
  p_prompt text,
  p_limit int,
  p_cost int DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start timestamptz;
  v_used        int;
  v_id          uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  v_month_start := date_trunc('month', now());

  SELECT COALESCE(SUM(cost), 0)
  INTO v_used
  FROM generation_history
  WHERE user_id    = p_user_id
    AND created_at >= v_month_start
    AND status     IN ('pending', 'success');

  IF v_used + p_cost > p_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'used',    v_used,
      'limit',   p_limit
    );
  END IF;

  INSERT INTO generation_history (user_id, prompt, platform, gen_type, code, status, cost)
  VALUES (p_user_id, left(p_prompt, 500), 'html', p_gen_type, '', 'pending', p_cost)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'allowed',       true,
    'generation_id', v_id::text,
    'used',          v_used + p_cost,
    'limit',         p_limit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_generation_credit TO authenticated;
