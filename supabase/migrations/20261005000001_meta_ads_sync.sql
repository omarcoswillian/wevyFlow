-- Sincronização de anúncios reais da Meta Marketing API em ad_watch_creatives.
-- external_id = id do anúncio na Meta; meta_ad_account_id = conta de origem
-- (proveniência, pra poder apagar/trocar de conta sem sobrar dado órfão).
-- UNIQUE não-parcial: linhas sem external_id (mock) têm NULL e NULL nunca
-- colide em UNIQUE no Postgres, então o upsert por (user_id, source,
-- external_id) funciona com supabase-js.
ALTER TABLE public.ad_watch_creatives
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS meta_ad_account_id text;

ALTER TABLE public.ad_watch_creatives
  ADD CONSTRAINT ad_watch_creatives_user_source_external_key UNIQUE (user_id, source, external_id);

-- Controle de frequência: evita bater na Marketing API a cada abertura de tela.
ALTER TABLE public.meta_ads_connections
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
