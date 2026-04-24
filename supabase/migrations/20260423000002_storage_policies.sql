-- Storage policies for project-covers bucket

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own project covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own covers
CREATE POLICY "Users can update their own project covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own covers
CREATE POLICY "Users can delete their own project covers"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to project covers
CREATE POLICY "Project covers are publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'project-covers');
