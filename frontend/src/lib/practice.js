import { supabase } from "./supabase";

const CATALOG_CACHE_KEY = "swift:practice-catalog:v1";
const CATALOG_CACHE_TTL = 30 * 60 * 1000;
let catalogRequest = null;

function readCatalogCache() {
  try {
    const cached = JSON.parse(window.localStorage.getItem(CATALOG_CACHE_KEY));
    if (!cached || Date.now() - cached.savedAt > CATALOG_CACHE_TTL) return null;
    return Array.isArray(cached.courses) ? cached.courses : null;
  } catch {
    return null;
  }
}

function writeCatalogCache(courses) {
  try {
    window.localStorage.setItem(
      CATALOG_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), courses })
    );
  } catch {
    // Private browsing and full storage should not block practice.
  }
}

async function backendJson(path, options) {
  const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}${path}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Swift could not load this data.");
  return data;
}

export async function getPracticeCourses() {
  const cached = readCatalogCache();
  if (cached) return cached;
  if (catalogRequest) return catalogRequest;

  catalogRequest = (async () => {
    const { data, error } = await supabase.rpc("get_practice_courses_catalog");
    let courses;

    if (!error && Array.isArray(data)) {
      courses = data;
    } else {
      const fallback = await backendJson("/practice-courses");
      courses = fallback.courses || [];
    }

    writeCatalogCache(courses);
    return courses;
  })();

  try {
    return await catalogRequest;
  } finally {
    catalogRequest = null;
  }
}

export async function getQuizQuestions({
  courseCode,
  questionType,
  numQuestions,
  section = null,
}) {
  const { data, error } = await supabase.rpc("get_course_quiz", {
    p_course_code: courseCode,
    p_question_type: questionType,
    p_num_questions: numQuestions,
    p_section: section,
  });

  if (!error && data?.questions) return data;

  const endpoint = questionType === "theory" ? "/generate-theory-question" : "/quiz";
  return backendJson(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      course_code: courseCode,
      question_type: questionType,
      num_questions: numQuestions,
      section,
    }),
  });
}
