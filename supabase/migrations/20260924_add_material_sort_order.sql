begin;

alter table public.materials
  add column if not exists material_sort_order integer;

alter table public.material_review_log
  add column if not exists previous_sort_order integer;

alter table public.material_review_log
  add column if not exists new_sort_order integer;

commit;
