begin;

create or replace function public.get_practice_courses_catalog()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with candidate_banks as (
    select
      course_code,
      question_type,
      jsonb_array_length(coalesce(questions, '[]'::jsonb)) as question_count,
      1 as source_priority
    from public.question_banks

    union all

    select
      course_code,
      question_type,
      jsonb_array_length(coalesce(questions, '[]'::jsonb)) as question_count,
      2 as source_priority
    from public.course_content_question_banks
    where status = 'approved'

    union all

    select
      course_code,
      question_type,
      sum(jsonb_array_length(coalesce(questions, '[]'::jsonb)))::integer as question_count,
      3 as source_priority
    from public.material_question_banks
    where status = 'approved'
    group by course_code, question_type
  ),
  selected_banks as (
    select distinct on (course_code, question_type)
      course_code,
      question_type,
      question_count
    from candidate_banks
    where question_count > 0
    order by course_code, question_type, source_priority
  ),
  course_catalog as (
    select
      courses.id,
      courses.code,
      courses.title,
      courses.level,
      courses.description,
      jsonb_agg(
        jsonb_build_object(
          'type', selected_banks.question_type,
          'question_count', selected_banks.question_count
        )
        order by selected_banks.question_type
      ) as banks
    from selected_banks
    join public.courses on courses.code = selected_banks.course_code
    group by courses.id, courses.code, courses.title, courses.level, courses.description
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'code', code,
        'title', title,
        'level', level,
        'description', description,
        'banks', banks
      )
      order by level nulls last, code
    ),
    '[]'::jsonb
  )
  from course_catalog;
$$;

create or replace function public.get_course_quiz(
  p_course_code text,
  p_question_type text,
  p_num_questions integer default 10,
  p_section text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  source_questions jsonb;
  filtered_questions jsonb;
  selected_questions jsonb;
  bank_kind text := 'curated';
  material_count integer := 0;
  safe_count integer := greatest(1, least(coalesce(p_num_questions, 10), 100));
begin
  if p_question_type not in ('mcq', 'german', 'theory') then
    raise exception 'Unsupported question type';
  end if;

  select questions
  into source_questions
  from public.question_banks
  where course_code = upper(trim(p_course_code))
    and question_type = p_question_type
  limit 1;

  if source_questions is null then
    select questions
    into source_questions
    from public.course_content_question_banks
    where course_code = upper(trim(p_course_code))
      and question_type = p_question_type
      and status = 'approved'
    limit 1;
    bank_kind := 'verified_course_outline';
  end if;

  if source_questions is null then
    select
      coalesce(jsonb_agg(question), '[]'::jsonb),
      count(distinct bank.material_id)::integer
    into source_questions, material_count
    from public.material_question_banks bank
    cross join lateral jsonb_array_elements(coalesce(bank.questions, '[]'::jsonb)) question
    where bank.course_code = upper(trim(p_course_code))
      and bank.question_type = p_question_type
      and bank.status = 'approved';
    bank_kind := 'generated_material_pool';
  end if;

  if source_questions is null or jsonb_array_length(source_questions) = 0 then
    raise exception 'No % question bank exists yet for %', p_question_type, upper(trim(p_course_code));
  end if;

  filtered_questions := source_questions;
  if nullif(trim(coalesce(p_section, '')), '') is not null then
    select coalesce(jsonb_agg(question), '[]'::jsonb)
    into filtered_questions
    from jsonb_array_elements(source_questions) question
    where coalesce(question ->> 'question', '') ilike '%' || trim(p_section) || '%';

    if jsonb_array_length(filtered_questions) = 0 then
      filtered_questions := source_questions;
    end if;
  end if;

  select coalesce(jsonb_agg(question), '[]'::jsonb)
  into selected_questions
  from (
    select question
    from jsonb_array_elements(filtered_questions) question
    order by random()
    limit safe_count
  ) shuffled;

  return jsonb_build_object(
    'course_code', upper(trim(p_course_code)),
    'question_type', p_question_type,
    'questions', selected_questions,
    'from_bank', true,
    'bank_kind', bank_kind,
    'bank_size', jsonb_array_length(source_questions),
    'materials_in_pool', material_count
  );
end;
$$;

revoke all on function public.get_practice_courses_catalog() from public;
revoke all on function public.get_course_quiz(text, text, integer, text) from public;

grant execute on function public.get_practice_courses_catalog() to anon, authenticated;
grant execute on function public.get_course_quiz(text, text, integer, text) to anon, authenticated;

commit;
