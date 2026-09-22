begin;

alter table public.materials
  add column if not exists category text;

alter table public.materials
  drop constraint if exists materials_category_check;

update public.materials
set category = 'uncategorized';

alter table public.materials
  alter column category set default 'uncategorized';

alter table public.materials
  alter column category set not null;

alter table public.materials
  add constraint materials_category_check
  check (
    category in (
      'uncategorized',
      'lecture_notes',
      'slides',
      'past_questions',
      'assignments',
      'practice',
      'textbooks',
      'references',
      'other'
    )
  );

alter table public.materials
  add column if not exists category_confidence integer not null default 0
  check (category_confidence between 0 and 100);

alter table public.materials
  add column if not exists category_source text not null default 'unreviewed'
  check (
    category_source in (
      'unreviewed',
      'content_analysis',
      'manual_review'
    )
  );

alter table public.materials
  add column if not exists category_evidence text;

alter table public.materials
  add column if not exists classification_status text not null default 'pending'
  check (
    classification_status in (
      'pending',
      'processing',
      'auto_classified',
      'needs_review',
      'failed',
      'reviewed'
    )
  );

alter table public.materials
  add column if not exists classification_error text;

alter table public.materials
  add column if not exists classified_at timestamptz;

commit;
