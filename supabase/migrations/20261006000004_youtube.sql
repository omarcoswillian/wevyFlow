-- Aba YouTube em Anúncios (Fase 1, só leitura): conexão Google, vídeos do canal e
-- métricas por período. Mesmo desenho da integração Meta: o refresh token fica
-- cifrado e só o servidor (service role) lê a conexão.

CREATE TABLE IF NOT EXISTS public.youtube_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  channel_id text NOT NULL,
  channel_title text,
  channel_picture_url text,
  uploads_playlist_id text,
  last_synced_at timestamptz,
  -- null = ainda não testado; false = a API não entregou CTR de thumbnail pra esse canal.
  ctr_available boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.youtube_connections ENABLE ROW LEVEL SECURITY;
-- Sem policies: nenhum acesso pelo client, só service role.

CREATE TABLE IF NOT EXISTS public.youtube_videos (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id text NOT NULL,
  title text NOT NULL,
  published_at timestamptz NOT NULL,
  thumbnail_url text,
  thumbnail_path text,
  duration_seconds integer NOT NULL DEFAULT 0,
  view_count bigint NOT NULL DEFAULT 0,
  like_count bigint NOT NULL DEFAULT 0,
  comment_count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own youtube videos"
  ON public.youtube_videos FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS youtube_videos_user_published_idx ON public.youtube_videos (user_id, published_at DESC);

CREATE TABLE IF NOT EXISTS public.youtube_video_metrics (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id text NOT NULL,
  period_days integer NOT NULL,
  views bigint NOT NULL DEFAULT 0,
  minutes_watched numeric NOT NULL DEFAULT 0,
  avg_view_duration_seconds numeric NOT NULL DEFAULT 0,
  avg_view_percentage numeric NOT NULL DEFAULT 0,
  likes bigint NOT NULL DEFAULT 0,
  comments bigint NOT NULL DEFAULT 0,
  subscribers_gained bigint NOT NULL DEFAULT 0,
  thumb_impressions bigint,
  thumb_ctr numeric,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id, period_days)
);
ALTER TABLE public.youtube_video_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own youtube metrics"
  ON public.youtube_video_metrics FOR SELECT USING (auth.uid() = user_id);
