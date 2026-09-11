-- Monitoramento de páginas de clientes (URL externa, não necessariamente
-- feita na WevyFlow) — status HTTP/tempo de resposta + nota do Google
-- PageSpeed Insights. Sob demanda (botão "Verificar agora"), só o
-- resultado da última checagem por enquanto — sem histórico/gráfico nesta
-- v1 (decisão explícita do dono, pode evoluir depois, mesmo padrão do
-- Gerenciador de Anúncios: simples primeiro, iterar depois).
--
-- RLS normal (não é tabela server-only como meta_ads_connections) — só
-- URL/nota/status, nada sensível, o client autenticado comum pode
-- ler/escrever suas próprias linhas direto.
CREATE TABLE IF NOT EXISTS public.page_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  label text,

  last_checked_at timestamptz,
  http_status integer,
  is_up boolean,
  response_time_ms integer,
  check_error text,

  pagespeed_checked_at timestamptz,
  pagespeed_performance integer,
  pagespeed_seo integer,
  pagespeed_accessibility integer,
  pagespeed_best_practices integer,
  pagespeed_error text,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.page_monitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own page monitors"
  ON public.page_monitors FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER page_monitors_updated_at
  BEFORE UPDATE ON public.page_monitors
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX IF NOT EXISTS page_monitors_user_id_idx ON public.page_monitors (user_id);
