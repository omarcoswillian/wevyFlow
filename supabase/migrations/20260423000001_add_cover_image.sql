alter table public.projects
  add column if not exists cover_image text not null default '';
