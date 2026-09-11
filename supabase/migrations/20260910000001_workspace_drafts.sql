-- O draft do Workspace (código editado a partir de um prompt gerado fora de
-- um projeto) só existia em localStorage, chaveado por um hash simples do
-- prompt (`wf:draft:${h}`) sujeito a colisão entre prompts diferentes, e
-- apagado a qualquer momento pela limpeza automática de storage
-- (aggressiveCleanup em storage-compact.ts) quando o navegador enchia — o
-- maior risco de perda de dado real do usuário no app. Migrando para uma
-- tabela: chaveada pelo texto exato do prompt (sem colisão de hash), global
-- por usuário (o Workspace gera fora de projeto/lançamento, então não há
-- launch_kit/project pra vincular ainda — vira página real só no "Publicar").
CREATE TABLE IF NOT EXISTS public.workspace_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  prompt text NOT NULL,
  code text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, prompt)
);

ALTER TABLE public.workspace_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workspace drafts"
  ON public.workspace_drafts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER workspace_drafts_updated_at
  BEFORE UPDATE ON public.workspace_drafts
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX IF NOT EXISTS workspace_drafts_user_id_idx ON public.workspace_drafts (user_id);
