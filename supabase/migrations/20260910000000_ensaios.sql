-- Ensaio Fotográfico não persistia em lugar nenhum (nem localStorage, nem
-- banco) — resultados gerados viviam só em useState e sumiam em qualquer
-- refresh/navegação. Mesmo padrão da tabela `criativos` (20260424000001):
-- global por usuário, sem vínculo com launch_kits (a tela hoje não tem
-- contexto de lançamento/projeto).
CREATE TABLE IF NOT EXISTS public.ensaios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  style_id text NOT NULL,
  style_name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.ensaios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ensaios"
  ON public.ensaios FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ensaios_user_id_created_at_idx
  ON public.ensaios (user_id, created_at DESC);
