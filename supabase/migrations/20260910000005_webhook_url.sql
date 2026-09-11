-- URL de webhook (Zapier/Make/etc) pra onde leads capturados nos formulários
-- das páginas geradas são enviados. Só existia em localStorage
-- ("wf_webhook_url"), perdida ao trocar de navegador — é configuração de
-- negócio real (destino de dados de leads), não uma chave de API pessoal.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS webhook_url text NOT NULL DEFAULT '';
