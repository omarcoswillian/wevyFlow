-- Carrossel: feature própria (editor manual por slide), separada de Criativos.
-- Um carrossel tem N slides ordenados; cada slide guarda o estado editável do
-- fabric.js (fabric_json) e uma miniatura renderizada (thumbnail_url) para
-- listagem/preview sem precisar recarregar o canvas.

CREATE TABLE IF NOT EXISTS public.carousels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT 'Carrossel sem título',
  format text NOT NULL DEFAULT '1:1',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.carousel_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carousel_id uuid REFERENCES public.carousels(id) ON DELETE CASCADE NOT NULL,
  position int NOT NULL DEFAULT 0,
  fabric_json jsonb,
  thumbnail_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS carousel_slides_carousel_id_idx ON public.carousel_slides (carousel_id);

ALTER TABLE public.carousels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carousel_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own carousels"
  ON public.carousels FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own carousel slides"
  ON public.carousel_slides FOR ALL
  USING (EXISTS (SELECT 1 FROM public.carousels c WHERE c.id = carousel_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.carousels c WHERE c.id = carousel_id AND c.user_id = auth.uid()));
