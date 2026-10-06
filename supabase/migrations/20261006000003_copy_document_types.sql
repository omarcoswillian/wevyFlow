-- Copy organizada em pastas: Criativos (type = 'ads'), Carrosséis e Thumbs.
ALTER TABLE public.copy_documents DROP CONSTRAINT IF EXISTS copy_documents_type_check;
ALTER TABLE public.copy_documents
  ADD CONSTRAINT copy_documents_type_check CHECK (type IN ('ads', 'carrossel', 'thumb'));
