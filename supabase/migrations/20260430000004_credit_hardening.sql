-- ── Credit system hardening ──────────────────────────────────────────────────
-- Adds: status column, error_message, atomic claim RPC, finalize RPC.
-- All ALTER TABLE use IF NOT EXISTS — safe to run multiple times.

-- 1. Add gen_type if migration 3 was not applied
ALTER TABLE public.generation_history
  ADD COLUMN IF NOT EXISTS gen_type text NOT NULL DEFAULT 'landing_page';

-- 2. Add status column (pending → success | failed_refunded)
ALTER TABLE public.generation_history
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success';

ALTER TABLE public.generation_history
  DROP CONSTRAINT IF EXISTS generation_history_status_check;

ALTER TABLE public.generation_history
  ADD CONSTRAINT generation_history_status_check
  CHECK (status IN ('pending', 'success', 'failed_refunded'));

-- 3. Add error_message for diagnostics
ALTER TABLE public.generation_history
  ADD COLUMN IF NOT EXISTS error_message text;

-- 4. Composite index for fast monthly count (excludes refunded)
CREATE INDEX IF NOT EXISTS generation_history_credit_count_idx
  ON public.generation_history (user_id, status, created_at);

-- 5. Fix user_profiles plan constraint to include 'starter'
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_plan_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_plan_check
  CHECK (plan IN ('free', 'starter', 'pro', 'scale'));

-- 6. Atomic credit claim — prevents race conditions via advisory lock
--    Returns: { allowed, generation_id, used, limit } or { allowed: false, used, limit }
CREATE OR REPLACE FUNCTION public.claim_generation_credit(
  p_user_id uuid,
  p_gen_type text,
  p_prompt text,
  p_limit int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start timestamptz;
  v_count       int;
  v_id          uuid;
BEGIN
  -- Serialize concurrent claims for the same user
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  v_month_start := date_trunc('month', now());

  -- Count only non-refunded generations this month
  SELECT COUNT(*)
  INTO v_count
  FROM generation_history
  WHERE user_id    = p_user_id
    AND created_at >= v_month_start
    AND status     IN ('pending', 'success');

  -- Enforce limit
  IF v_count >= p_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'used',    v_count,
      'limit',   p_limit
    );
  END IF;

  -- Insert pending row inside the same transaction + lock
  INSERT INTO generation_history (user_id, prompt, platform, gen_type, code, status)
  VALUES (p_user_id, left(p_prompt, 500), 'html', p_gen_type, '', 'pending')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'allowed',       true,
    'generation_id', v_id::text,
    'used',          v_count + 1,
    'limit',         p_limit
  );
END;
$$;

-- 7. Finalize generation: confirm success or refund the credit
CREATE OR REPLACE FUNCTION public.finalize_generation(
  p_id      uuid,
  p_success boolean,
  p_error   text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE generation_history
  SET
    status        = CASE WHEN p_success THEN 'success' ELSE 'failed_refunded' END,
    error_message = p_error
  WHERE id = p_id;
END;
$$;

-- 8. Grant to authenticated role
GRANT EXECUTE ON FUNCTION public.claim_generation_credit TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_generation      TO authenticated;
