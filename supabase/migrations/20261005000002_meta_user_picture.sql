-- Foto do perfil Meta conectado (exibida no cabeçalho de Anúncios). É só uma
-- URL pública da CDN da Meta; apagada junto com a conexão.
ALTER TABLE public.meta_ads_connections
  ADD COLUMN IF NOT EXISTS meta_user_picture_url text;
