CREATE TABLE IF NOT EXISTS public.criativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  format text NOT NULL,
  url text NOT NULL,
  headline text,
  produto text,
  prompt text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.criativos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own criativos"
  ON public.criativos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
