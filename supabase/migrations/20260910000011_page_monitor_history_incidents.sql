-- Fase 2 do Monitoramento de Páginas: checagem automática agendada
-- (uptime + SSL, 1x/dia — PageSpeed continua só sob demanda, ver
-- comentário na rota do cron) + histórico + incidentes com limiar de
-- falhas consecutivas antes de abrir (evita alarme falso por instabilidade
-- passageira), mesmo padrão do "Prymo Monitora" (repo de referência).
ALTER TABLE public.page_monitors
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.page_monitor_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_monitor_id uuid REFERENCES public.page_monitors(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  page_status text NOT NULL,
  http_status integer,
  response_time_ms integer,
  error text,
  checked_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.page_monitor_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own page monitor history"
  ON public.page_monitor_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS page_monitor_history_monitor_date_idx
  ON public.page_monitor_history (page_monitor_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS public.page_monitor_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_monitor_id uuid REFERENCES public.page_monitors(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  message text NOT NULL,
  probable_cause text,
  consecutive_failures_at_open integer,
  final_status text,
  started_at timestamptz DEFAULT now() NOT NULL,
  resolved_at timestamptz
);

ALTER TABLE public.page_monitor_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own page monitor incidents"
  ON public.page_monitor_incidents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS page_monitor_incidents_open_idx
  ON public.page_monitor_incidents (page_monitor_id) WHERE resolved_at IS NULL;
