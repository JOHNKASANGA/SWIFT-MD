begin;

with incoming (
  title,
  file_url,
  category,
  material_summary,
  material_priority,
  material_sort_order
) as (
  values
    ('How Microbes Grow', 'https://drive.google.com/file/d/1uqWZPhx8mtkJcNes7l3R56gvtaAIHw23/view', 'lecture_notes', 'Reading on microbial growth for biochemical engineering.', 'recommended', 10),
    ('CHG 437 Lecture Note 3.1', 'https://drive.google.com/file/d/1MH65YdhsoWiDnkXGLXrbWXYziE6UxUDx/view', 'lecture_notes', 'Legacy CHG 437 biochemical engineering lecture material.', 'core', 20),
    ('Biochemical Engineering Assignment 1', 'https://drive.google.com/file/d/1VCGB5UE_yB3iSUyZlFiwjJOvQWqjm1Hy/view', 'assignments', 'Course assignment supplied with the legacy CHG 437 collection.', 'supplementary', 30),
    ('CHG 437 Note by Professor Ogunbayo', 'https://drive.google.com/file/d/1O0K_4FGa0Y1NxlIvZ5hfK0Q_AQnqXzdh/view', 'lecture_notes', 'Biochemical engineering course note by Professor Ogunbayo.', 'core', 40),
    ('Bioremediation in the Hydrocarbon Industry', 'https://drive.google.com/file/d/11VVrjKSxbNApHX1hUkznYjzvLL7UOnUC/view', 'slides', 'Presentation on bioremediation applications in the hydrocarbon industry.', 'recommended', 50),
    ('Cell Culture Technology', 'https://drive.google.com/file/d/1lTizK28R_5MJeCA5fwz9WYKptqZolctK/view', 'lecture_notes', 'Course material covering cell culture technology.', 'recommended', 60),
    ('CHG 437 Note by Dr Olanipekun', 'https://drive.google.com/file/d/1YufjauYHHsw-yXPcX5mIIgdmvt290Hyq/view', 'lecture_notes', 'Biochemical engineering course note by Dr Olanipekun.', 'core', 70),
    ('CHG 437 Compressed Slides', 'https://drive.google.com/file/d/1vLhfmBHFas9b1aiAqWhJwl5ao__KP67o/view', 'slides', 'Condensed biochemical engineering lecture slides.', 'recommended', 80),
    ('CHG 437 Tutorial Solutions', 'https://drive.google.com/file/d/1xy_Y4BXvdcwN0OBd7UjakElisOTQUm0m/view', 'practice', 'Worked tutorial solutions for biochemical engineering.', 'recommended', 90),
    ('Dr Olanipekun Biochemical Engineering Note', 'https://drive.google.com/file/d/1qazqSNz0nmR7srQCMf-0D4SslqEiQA6P/view', 'lecture_notes', 'Additional biochemical engineering note by Dr Olanipekun.', 'recommended', 100),
    ('Dr Ogunbayo Biochemical Engineering Note', 'https://drive.google.com/file/d/1-QiE5GhmY9GNxnQEgzyDb8xq3XvGrlXo/view', 'lecture_notes', 'Additional biochemical engineering note by Dr Ogunbayo.', 'recommended', 110),
    ('CHG 437 2019/2020 Examination Calculations', 'https://drive.google.com/file/d/1vz2hih5j846r1gLTvl-8S3IWOky2L0UL/view', 'past_questions', 'Calculation solutions associated with the 2019/2020 examination.', 'recommended', 120),
    ('Gasohol Production in Nigeria', 'https://drive.google.com/file/d/1dOW8WAGbJYhBNjOXfAC6D5NlIzEyLUji/view', 'slides', 'Student presentation on gasohol production in Nigeria.', 'supplementary', 130),
    ('CHG 437 Group Project', 'https://drive.google.com/file/d/1uHPVtwSfOxZvSVYYYFZz00JBEuUEFNaQ/view', 'slides', 'Biochemical engineering group project presentation.', 'supplementary', 140),
    ('Biosensor Technology', 'https://drive.google.com/file/d/1KGvpywrj3GbmhDUBjPtw4RAgxKzz5QAj/view', 'slides', 'Student presentation on biosensor technology.', 'supplementary', 150),
    ('Microbial Growth Kinetics by Olanipekun', 'https://drive.google.com/file/d/15oC9fSkeHrsAiieTW1aJPUW4vCStU0RT/view', 'lecture_notes', 'Detailed CHG 437 note on microbial growth kinetics.', 'core', 160),
    ('Microbial Growth Kinetics', 'https://drive.google.com/file/d/1ACaUG2yuGiLmvTaC34Wc8gaVHXoVmNNX/view', 'lecture_notes', 'Supporting material on microbial growth kinetics.', 'recommended', 170),
    ('Microbial Growth', 'https://drive.google.com/file/d/1lnVv3vCcLF1TzPh_4cqcY6WIzXMkmsgs/view', 'lecture_notes', 'Supporting material on microbial growth.', 'recommended', 180),
    ('Recombinant DNA Technology in Biomedical Engineering', 'https://drive.google.com/file/d/1hps0jK4KDyxtD0LNzRJBzDhq5YTIGY3x/view', 'references', 'Reference reading on recombinant DNA technology and biomedical engineering.', 'reference', 190),
    ('Biochemical Engineering Tutorial', 'https://drive.google.com/file/d/13PDqZkbv7zU9NKXwhn3My4sgfuW4hyDu/view', 'practice', 'Tutorial exercises from the legacy CHG 437 collection.', 'recommended', 200),
    ('TCH 307 Past Questions Folder', 'https://drive.google.com/drive/folders/1ehWZiz-wQlbqB6MB5Ka7a0Renj0AORPH', 'past_questions', 'Shared folder containing additional biochemical engineering past questions.', 'reference', 210),
    ('TCH 307 Textbooks Folder', 'https://drive.google.com/drive/folders/11XAL0HB5R9qOpqVdMxhnvyQsyHutACG-', 'textbooks', 'Shared folder containing additional biochemical engineering textbooks.', 'reference', 220),
    ('TCH 307 Assignment Solutions Folder', 'https://drive.google.com/drive/folders/1_9cOh5qUo_vRfVznTTf5qTgv46s1mJuc', 'assignments', 'Shared folder containing biochemical engineering assignment solutions.', 'reference', 230)
)
insert into public.materials (
  course_code,
  title,
  file_url,
  category,
  category_confidence,
  category_source,
  category_evidence,
  classification_status,
  classified_at,
  source_name,
  material_summary,
  resource_kind,
  material_priority,
  priority_reason,
  priority_source,
  priority_updated_at,
  material_sort_order
)
select
  'TCH 307',
  incoming.title,
  incoming.file_url,
  incoming.category,
  100,
  'manual_review',
  'Reviewed from the shared CHG 437 Introduction to Biochemical Engineering Drive collection.',
  'reviewed',
  now(),
  'CHG PG Online Library',
  incoming.material_summary,
  case when incoming.file_url like '%/folders/%' then 'website' else 'document' end,
  incoming.material_priority,
  'Reviewed for relevance to TCH 307 Biochemical Engineering.',
  'manual_review',
  now(),
  incoming.material_sort_order
from incoming
where not exists (
  select 1
  from public.materials existing
  where existing.file_url = incoming.file_url
);

commit;
