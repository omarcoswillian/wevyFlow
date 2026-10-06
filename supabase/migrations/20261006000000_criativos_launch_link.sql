-- Peças de design passam a pertencer a um lançamento e têm status de
-- aprovação, pra o Hub do lançamento poder listar e aprovar o que foi gerado
-- (antes `criativos` era uma galeria global por usuário, sem vínculo).
alter table public.criativos
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists status text not null default 'draft',
  add column if not exists copy_headline text,
  add column if not exists copy_cta text,
  add column if not exists text_layer boolean not null default false;

alter table public.criativos
  drop constraint if exists criativos_status_check;
alter table public.criativos
  add constraint criativos_status_check check (status in ('draft', 'approved'));

create index if not exists criativos_project_id_idx on public.criativos (project_id, created_at desc);
