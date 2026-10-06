-- Registro de testes A/B de thumbnail feitos no YouTube Studio ("Testar e comparar")
-- e CTR/impressões importados do export do Studio (a API não entrega esse número).

CREATE TABLE IF NOT EXISTS public.youtube_thumbnail_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id text NOT NULL,
  hypothesis text NOT NULL,
  analysis_id uuid REFERENCES public.ad_creative_analyses(id) ON DELETE SET NULL,
  -- [{ "label": "Original" | "Variante 1", "criativo_id": uuid|null, "url": text|null, "watch_share": number|null }]
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'finished')),
  winner_label text,
  note text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.youtube_thumbnail_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own youtube thumbnail tests"
  ON public.youtube_thumbnail_tests FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS youtube_thumbnail_tests_user_idx ON public.youtube_thumbnail_tests (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.youtube_studio_ctr (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  impressions bigint NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0, -- fração (0.064 = 6,4%)
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id, period_start, period_end)
);
ALTER TABLE public.youtube_studio_ctr ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own youtube studio ctr"
  ON public.youtube_studio_ctr FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
