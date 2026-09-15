-- Copy (aba nova, separada de Design): documentos de copy gerados por IA
-- (headline + CTA de anúncios na Fase 1; carrossel/captura/vendas em fases
-- seguintes) persistidos, editáveis e reabríveis — ver memória
-- project-copy-vs-design-architecture. Opcionalmente vinculados a um
-- lançamento (project_id), mas funcionam também avulsos.
CREATE TABLE IF NOT EXISTS public.copy_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'ads' CHECK (type IN ('ads')),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  -- Snapshot dos fatos usados na geração (produto/nicho/público/etc) — não
  -- muda retroativamente se o briefing do lançamento for editado depois.
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- As opções geradas pela IA: [{headline, cta, angle}, ...]
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- A opção escolhida/editada pelo usuário, se houver: {headline, cta}
  selected jsonb,
  model text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.copy_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own copy documents"
  ON public.copy_documents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER copy_documents_updated_at
  BEFORE UPDATE ON public.copy_documents
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX IF NOT EXISTS copy_documents_user_id_idx ON public.copy_documents (user_id);
CREATE INDEX IF NOT EXISTS copy_documents_project_id_idx ON public.copy_documents (project_id);
