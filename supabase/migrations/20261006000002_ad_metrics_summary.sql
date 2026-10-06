-- Soma os insights diários por anúncio num intervalo. SECURITY INVOKER: a RLS de
-- meta_ads_daily_insights limita ao próprio usuário, então não precisa de user_id.
CREATE OR REPLACE FUNCTION public.ad_metrics_summary(p_from date, p_to date)
RETURNS TABLE (
  ad_external_id text,
  spend numeric,
  impressions bigint,
  clicks bigint,
  purchases numeric,
  purchase_value numeric,
  video_plays bigint,
  video_thruplays bigint,
  video_p25 bigint,
  video_p100 bigint,
  currency text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    i.ad_external_id,
    sum(i.spend),
    sum(i.impressions)::bigint,
    sum(i.clicks)::bigint,
    sum(i.purchases),
    sum(i.purchase_value),
    sum(i.video_plays)::bigint,
    sum(i.video_thruplays)::bigint,
    sum(i.video_p25)::bigint,
    sum(i.video_p100)::bigint,
    max(i.currency)
  FROM public.meta_ads_daily_insights i
  WHERE i.date >= p_from AND i.date <= p_to
  GROUP BY i.ad_external_id;
$$;

GRANT EXECUTE ON FUNCTION public.ad_metrics_summary(date, date) TO authenticated;
