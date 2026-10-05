-- Registro dos pedidos de exclusão/desautorização que a Meta envia (callback
-- de "Data Deletion Request" e "Deauthorize"). Serve de comprovante: a Meta
-- exige uma URL de status por confirmation_code, e a LGPD pede que a
-- exclusão seja demonstrável. NÃO guarda o id Meta (nem em hash): o código
-- aleatório de 128 bits basta pra consultar o status.
--
-- RLS habilitada SEM policy: só acessível via service role.
CREATE TABLE IF NOT EXISTS public.meta_data_deletion_requests (
  confirmation_code text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('deletion', 'deauthorize')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  connections_deleted integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.meta_data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Exclusão atômica: apagar dados derivados, apagar conexões e registrar o
-- comprovante na MESMA transação (tudo ou nada). Lock consultivo por id Meta
-- serializa pedidos concorrentes do mesmo usuário.
CREATE OR REPLACE FUNCTION public.delete_meta_user_data(
  p_meta_user_id text,
  p_kind text,
  p_confirmation_code text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_ids uuid[];
  v_deleted integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('meta_delete:' || p_meta_user_id));

  SELECT coalesce(array_agg(user_id), '{}') INTO v_user_ids
    FROM public.meta_ads_connections WHERE meta_user_id = p_meta_user_id;

  DELETE FROM public.ad_watch_creatives
    WHERE user_id = ANY (v_user_ids) AND source = 'meta_ads_api';

  DELETE FROM public.meta_ads_connections WHERE meta_user_id = p_meta_user_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO public.meta_data_deletion_requests (confirmation_code, kind, status, connections_deleted)
    VALUES (p_confirmation_code, p_kind, 'completed', v_deleted);

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_meta_user_data(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_meta_user_data(text, text, text) TO service_role;
