begin;

drop policy if exists "Service role has full access" on public.courses;
drop policy if exists "Service role has full access" on public.materials;
drop policy if exists "Service role has full access" on public.question_banks;

drop policy if exists "Public read access to courses" on public.courses;
drop policy if exists "Public read access to materials" on public.materials;

create policy "Public read access to courses"
on public.courses
for select
to anon, authenticated
using (true);

create policy "Public read access to materials"
on public.materials
for select
to anon, authenticated
using (true);

commit;
