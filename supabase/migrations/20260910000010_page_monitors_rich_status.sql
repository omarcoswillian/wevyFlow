-- Fase 1 da evolução do Monitoramento de Páginas, inspirada no
-- "Prymo Monitora" (repo de referência do dono): status rico (5 estados
-- em vez de só no-ar/fora-do-ar), soft-404, bloqueio por WAF/CAPTCHA, SSL,
-- e Web Vitals reais do PageSpeed (não só as 4 notas de categoria).
ALTER TABLE public.page_monitors
  ADD COLUMN IF NOT EXISTS page_status text
    CHECK (page_status IN ('ONLINE', 'LENTO', 'OFFLINE', 'BLOQUEADO', 'TIMEOUT')),
  ADD COLUMN IF NOT EXISTS is_soft_404 boolean,
  ADD COLUMN IF NOT EXISTS blocked boolean,
  ADD COLUMN IF NOT EXISTS block_reason text,

  ADD COLUMN IF NOT EXISTS ssl_status text
    CHECK (ssl_status IN ('valid', 'expiring_soon', 'critical', 'expired', 'error', 'no_ssl')),
  ADD COLUMN IF NOT EXISTS ssl_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS ssl_days_remaining integer,
  ADD COLUMN IF NOT EXISTS ssl_issuer text,

  ADD COLUMN IF NOT EXISTS pagespeed_fcp integer,
  ADD COLUMN IF NOT EXISTS pagespeed_lcp integer,
  ADD COLUMN IF NOT EXISTS pagespeed_tbt integer,
  ADD COLUMN IF NOT EXISTS pagespeed_cls numeric(10, 4),
  ADD COLUMN IF NOT EXISTS pagespeed_speed_index integer;

COMMENT ON COLUMN public.page_monitors.page_status IS
  'ONLINE, LENTO (acima do limiar de resposta lenta), OFFLINE, BLOQUEADO (WAF/CAPTCHA detectado) ou TIMEOUT. is_up continua existindo, derivado deste campo, pra não quebrar leituras antigas.';
