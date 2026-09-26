-- The auto_categorize_material trigger predated the current category
-- taxonomy (see 20260922_add_material_classification.sql) and used
-- an incompatible Title Case value set (e.g. 'Course Materials',
-- 'Past Questions') that violates materials_category_check. It was
-- never checked into migrations. Category assignment is now handled
-- entirely in application code (importer scripts, admin review
-- endpoint), so this trigger is removed rather than reconciled.

begin;

drop trigger if exists auto_categorize_material on public.materials;
drop function if exists public.categorize_material();

commit;
