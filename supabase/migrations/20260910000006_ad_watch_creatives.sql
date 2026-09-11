-- Gerenciador de Anúncios (camada 2 do roadmap de Ads — ver memória
-- project-roadmap-ads-loop): lista de criativos monitorados com o proxy de
-- performance usado quando não há acesso a gasto/ROAS real (tempo no ar).
-- `source` = 'mock' até a fonte de dado real (Meta Ad Library API ou
-- Foreplay) ser validada e conectada — ver conversa 2026-09-10.
CREATE TABLE IF NOT EXISTS public.ad_watch_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source text NOT NULL DEFAULT 'mock' CHECK (source IN ('mock', 'meta_ad_library', 'foreplay', 'meta_ads_api')),
  advertiser_name text NOT NULL,
  headline text,
  body text,
  thumbnail_url text,
  platforms text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  started_at timestamptz NOT NULL,
  stopped_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.ad_watch_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ad watch creatives"
  ON public.ad_watch_creatives FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER ad_watch_creatives_updated_at
  BEFORE UPDATE ON public.ad_watch_creatives
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX IF NOT EXISTS ad_watch_creatives_user_id_idx ON public.ad_watch_creatives (user_id);
