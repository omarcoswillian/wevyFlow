-- Table to store user-approved AI-generated images (gallery)
CREATE TABLE IF NOT EXISTS public.ai_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  prompt text,
  mode text CHECK (mode IN ('create', 'edit', 'upload')) DEFAULT 'create',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.ai_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ai_images"
  ON public.ai_images FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Storage bucket for AI-generated and user-uploaded images
INSERT INTO storage.buckets (id, name, public) VALUES ('ai-images', 'ai-images', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload ai-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ai-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can read ai-images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'ai-images');

CREATE POLICY "Users can delete own ai-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'ai-images' AND (storage.foldername(name))[1] = auth.uid()::text);
