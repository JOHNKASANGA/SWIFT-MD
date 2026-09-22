begin;

create table if not exists public.course_outlines (
  course_code text primary key,
  official_title text not null,
  level integer not null check (level in (100, 200, 300)),
  semester text,
  units integer check (units is null or units > 0),
  concise_description text not null,
  ordered_topics jsonb not null default '[]'::jsonb,
  prerequisites text,
  recommended_textbooks jsonb not null default '[]'::jsonb,
  evidence_url text,
  verification_status text not null
    check (verification_status in ('verified', 'partially_verified', 'unverified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.course_outlines enable row level security;

drop policy if exists "Public read access to course outlines"
  on public.course_outlines;

create policy "Public read access to course outlines"
  on public.course_outlines
  for select
  to anon, authenticated
  using (true);

commit;
