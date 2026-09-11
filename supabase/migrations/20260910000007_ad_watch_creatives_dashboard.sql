-- Evolução da tela do Gerenciador de Anúncios: curadoria persistente
-- (favoritar), índices pros filtros de período/status, e thumbnails pros
-- registros fictícios já existentes (a v1 seedava sem imagem).
ALTER TABLE public.ad_watch_creatives
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ad_watch_creatives.is_favorite IS
  'Marca o criativo como referência favorita do usuário.';

CREATE INDEX IF NOT EXISTS ad_watch_creatives_user_started_at_idx
  ON public.ad_watch_creatives (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS ad_watch_creatives_user_status_started_at_idx
  ON public.ad_watch_creatives (user_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS ad_watch_creatives_user_stopped_at_idx
  ON public.ad_watch_creatives (user_id, stopped_at)
  WHERE stopped_at IS NOT NULL;

UPDATE public.ad_watch_creatives
SET thumbnail_url = CASE headline
  WHEN 'Como sair do zero a R$10k/mês em 90 dias'
    THEN '/library-seed/formagios/AD01V1-FEED.jpg'
  WHEN '3 erros que travam seu primeiro cliente'
    THEN '/library-seed/formagios/AD02.jpg'
  WHEN 'Reeducação alimentar sem passar fome'
    THEN '/library-seed/luana/AD02.png'
  WHEN 'Chá que acelera o metabolismo'
    THEN '/library-seed/luana/AD05.png'
  WHEN 'Passei em 8 meses estudando 2h por dia'
    THEN '/library-seed/ed/ED-dark-001.png'
  WHEN 'Edital publicado — o que estudar primeiro'
    THEN '/library-seed/ed/ED-white-001.png'
  WHEN 'Sérum que sumiu com minhas manchas'
    THEN '/library-seed/rpe/RPE-white-001.png'
  ELSE thumbnail_url
END
WHERE source = 'mock'
  AND thumbnail_url IS NULL;
