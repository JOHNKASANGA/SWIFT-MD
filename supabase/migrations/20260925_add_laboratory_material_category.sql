begin;

alter table public.materials
  drop constraint if exists materials_category_check;

alter table public.materials
  add constraint materials_category_check
  check (
    category in (
      'uncategorized',
      'lecture_notes',
      'slides',
      'past_questions',
      'assignments',
      'laboratory',
      'practice',
      'textbooks',
      'references',
      'other'
    )
  );

commit;