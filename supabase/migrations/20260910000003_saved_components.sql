-- Componentes salvos do editor visual (blocos HTML reutilizáveis que o
-- usuário salva a partir da Biblioteca do Workspace) só existiam em
-- localStorage ("wevyflow-components"), perdidos ao trocar de navegador.
CREATE TABLE IF NOT EXISTS public.saved_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  html text NOT NULL,
  tag text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.saved_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved components"
  ON public.saved_components FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER saved_components_updated_at
  BEFORE UPDATE ON public.saved_components
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX IF NOT EXISTS saved_components_user_id_idx ON public.saved_components (user_id);
