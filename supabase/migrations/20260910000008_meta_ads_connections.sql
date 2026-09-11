-- Conexão OAuth de cada usuário com a própria conta de Meta Ads (camada 3
-- do roadmap de Ads — ver memória project-roadmap-ads-loop). Uma linha por
-- usuário: token de acesso, a conta de anúncio escolhida (se o usuário
-- gerencia mais de uma, guarda a lista em available_ad_accounts até ele
-- escolher qual sincronizar).
--
-- RLS habilitada SEM nenhuma policy — mesmo padrão de
-- launch_asset_retry_attempts (20260909000001): só acessível via
-- createServiceClient() (service role), nunca pelo client autenticado
-- comum, nem mesmo pelo próprio dono da linha. Toda leitura/escrita passa
-- por uma API route que já resolveu o usuário via sessão antes de tocar
-- nessa tabela.
--
-- Nota de segurança: o token fica em texto puro nesta coluna, protegido só
-- por essa restrição de acesso a nível de RLS/service-role (não há
-- criptografia de coluna nesta v1 — não existe infraestrutura de gestão de
-- chave de criptografia no projeto ainda). Reavaliar antes de escalar pra
-- muitas contas de produção reais.
CREATE TABLE IF NOT EXISTS public.meta_ads_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  access_token text NOT NULL,
  token_expires_at timestamptz,
  meta_user_id text NOT NULL,
  meta_user_name text,
  available_ad_accounts jsonb NOT NULL DEFAULT '[]',
  ad_account_id text,
  ad_account_name text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.meta_ads_connections ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER meta_ads_connections_updated_at
  BEFORE UPDATE ON public.meta_ads_connections
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
