begin;

alter table public.material_submissions
  add column if not exists notified_at timestamptz;

commit;
