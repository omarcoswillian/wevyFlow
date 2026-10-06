-- Fase 1 do motor de criativos (ver memória project-design-replacement-direction):
-- performance real dos anúncios (insights diários), tipo de mídia (imagem/vídeo),
-- análise por IA do criativo e a linhagem anúncio -> hipótese -> peça gerada.

ALTER TABLE public.ad_watch_creatives
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS creative_id text,
  ADD COLUMN IF NOT EXISTS video_id text,
  ADD COLUMN IF NOT EXISTS image_hash text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS media_path text;

ALTER TABLE public.ad_watch_creatives DROP CONSTRAINT IF EXISTS ad_watch_creatives_media_type_check;
ALTER TABLE public.ad_watch_creatives
  ADD CONSTRAINT ad_watch_creatives_media_type_check CHECK (media_type IN ('image', 'video', 'unknown'));

-- Insights diários por anúncio. Diário (não acumulado) pra os filtros de período
-- somarem só o que aconteceu no intervalo. Escrito só pelo servidor (service role).
CREATE TABLE IF NOT EXISTS public.meta_ads_daily_insights (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_external_id text NOT NULL,
  meta_ad_account_id text NOT NULL,
  date date NOT NULL,
  spend numeric NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  purchases numeric NOT NULL DEFAULT 0,
  purchase_value numeric NOT NULL DEFAULT 0,
  video_plays bigint NOT NULL DEFAULT 0,
  video_thruplays bigint NOT NULL DEFAULT 0,
  video_p25 bigint NOT NULL DEFAULT 0,
  video_p50 bigint NOT NULL DEFAULT 0,
  video_p75 bigint NOT NULL DEFAULT 0,
  video_p100 bigint NOT NULL DEFAULT 0,
  currency text,
  PRIMARY KEY (user_id, ad_external_id, date)
);

ALTER TABLE public.meta_ads_daily_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own ad insights"
  ON public.meta_ads_daily_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS meta_ads_daily_insights_user_date_idx
  ON public.meta_ads_daily_insights (user_id, date);

-- Análise por IA do criativo (uma por anúncio; refazer sobrescreve).
CREATE TABLE IF NOT EXISTS public.ad_creative_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_external_id text NOT NULL,
  media_type text NOT NULL,
  coverage text NOT NULL CHECK (coverage IN ('full', 'partial')),
  analysis jsonb NOT NULL,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ad_external_id)
);

ALTER TABLE public.ad_creative_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own ad analyses"
  ON public.ad_creative_analyses FOR SELECT
  USING (auth.uid() = user_id);

-- Linhagem: de qual anúncio e de qual hipótese cada peça gerada veio.
ALTER TABLE public.criativos
  ADD COLUMN IF NOT EXISTS source_ad_external_id text,
  ADD COLUMN IF NOT EXISTS hypothesis text,
  ADD COLUMN IF NOT EXISTS analysis_id uuid REFERENCES public.ad_creative_analyses(id) ON DELETE SET NULL;

-- Exclusão de dados da Meta (deauthorize / data-deletion) também apaga o que
-- derivamos dos dados dela: insights e análises. A mídia no Storage é apagada
-- pela rota (SQL não remove objetos do Storage).
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

  DELETE FROM public.meta_ads_daily_insights WHERE user_id = ANY (v_user_ids);
  DELETE FROM public.ad_creative_analyses WHERE user_id = ANY (v_user_ids);
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
