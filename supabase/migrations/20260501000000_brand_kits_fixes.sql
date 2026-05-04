-- Fix brand_kits: add UNIQUE constraint on user_id so upsert works correctly.
-- Without this, upsert({ onConflict: "user_id" }) throws:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'brand_kits_user_id_key'
      AND conrelid = 'public.brand_kits'::regclass
  ) THEN
    ALTER TABLE public.brand_kits ADD CONSTRAINT brand_kits_user_id_key UNIQUE (user_id);
  END IF;
END;
$$;

-- Atomic page view increment to avoid read-then-write race condition
CREATE OR REPLACE FUNCTION public.increment_page_views(p_slug text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE published_pages SET views = views + 1 WHERE slug = p_slug;
$$;

GRANT EXECUTE ON FUNCTION public.increment_page_views TO anon;
GRANT EXECUTE ON FUNCTION public.increment_page_views TO authenticated;
