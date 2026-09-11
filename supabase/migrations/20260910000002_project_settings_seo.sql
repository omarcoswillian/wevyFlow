-- Configurações do projeto (domínio, descrição, favicon) e SEO
-- (title/description/OG image/noindex) só existiam em localStorage
-- (`wf-proj-${id}` / `wf-proj-seo-${id}`), perdidas ao trocar de navegador.
-- Migrando pra colunas em `projects` — dado por projeto, sem tabela nova
-- necessária.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS domain text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS favicon text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_og_image text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_no_index boolean NOT NULL DEFAULT false;
