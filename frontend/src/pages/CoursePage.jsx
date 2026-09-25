import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AppShell from "../components/AppShell";

const MATERIAL_SECTIONS = [
  {
    key: "lecture_notes",
    label: "Lecture notes",
    description: "Lectures, handouts, and topic explanations.",
  },
  {
    key: "slides",
    label: "Slides",
    description: "Presentation decks and visual teaching material.",
  },
  {
    key: "past_questions",
    label: "Past questions",
    description: "Previous tests, exams, and worked past papers.",
  },
  {
    key: "assignments",
    label: "Assignments",
    description: "Coursework, task sheets, and assignment solutions.",
  },
  {
    key: "laboratory",
    label: "Laboratory work",
    description:
      "Lab manuals, experiments, apparatus, reports, and practical data.",
  },
  {
    key: "practice",
    label: "Practice and tutorials",
    description: "Exercises, drills, worked problems, and tutorials.",
  },
  {
    key: "textbooks",
    label: "Textbooks",
    description: "Main books and substantial course texts.",
  },
  {
    key: "references",
    label: "References",
    description: "Supporting articles, standards, and specialist reading.",
  },
  {
    key: "other",
    label: "Other materials",
    description: "Materials still being reviewed or not yet grouped.",
  },
];

function getMaterialSection(material) {
  const category = material.category || "uncategorized";

  return MATERIAL_SECTIONS.some((section) => section.key === category)
    ? category
    : "other";
}

function sortMaterials(materials) {
  return [...materials].sort((first, second) =>
    first.title.localeCompare(second.title, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function MaterialRow({ material, index, onOpen }) {
  return (
    <button
      type="button"
      className="material-row"
      onClick={() => onOpen(material.id)}
    >
      <span className="material-number">
        {String(index + 1).padStart(2, "0")}
      </span>

      <span className="material-row-content">
        <span className="material-title">{material.title}</span>
      </span>

      <span className="material-open">
        Open <span aria-hidden="true">↗</span>
      </span>
    </button>
  );
}

function CourseOutline({ outline }) {
  if (!outline) return null;

  const topics = Array.isArray(outline.ordered_topics)
    ? outline.ordered_topics
    : [];

  const facts = [
    outline.units
      ? `${outline.units} ${outline.units === 1 ? "unit" : "units"}`
      : null,
    outline.semester,
  ].filter(Boolean);

  return (
    <section className="course-outline" aria-labelledby="course-outline-title">
      <div className="course-outline-heading">
        <div>
          <p className="swift-eyebrow">Course outline</p>
          <h2 id="course-outline-title">What you will cover.</h2>
        </div>

        {facts.length > 0 && (
          <p className="course-outline-facts">{facts.join(" · ")}</p>
        )}
      </div>

      <p className="course-outline-description">
        {outline.concise_description}
      </p>

      {topics.length > 0 && (
        <ol className="course-topic-list">
          {topics.map((topic, index) => (
            <li key={`${topic}-${index}`} className="course-topic-item">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{topic}</p>
            </li>
          ))}
        </ol>
      )}

      {outline.verification_status === "partially_verified" && (
        <p className="course-outline-note">
          This outline is being refined against available departmental material.
        </p>
      )}

      {outline.verification_status === "unverified" && (
        <p className="course-outline-note">
          This outline is provisional and awaits departmental confirmation.
        </p>
      )}
    </section>
  );
}

export default function CoursePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [outline, setOutline] = useState(null);
  const [hasPractice, setHasPractice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function fetchCoursePage() {
      try {
        const { data: courseData, error: courseError } = await supabase
          .from("courses")
          .select("*")
          .eq("id", id)
          .single();

        if (courseError) throw courseError;

        const [materialsResult, practiceResult, outlineResult] =
          await Promise.all([
            supabase
              .from("materials")
              .select("*")
              .eq("course_code", courseData.code)
              .order("title", { ascending: true }),
            fetch(`${import.meta.env.VITE_BACKEND_URL}/practice-courses`),
            supabase
              .from("course_outlines")
              .select("*")
              .eq("course_code", courseData.code)
              .maybeSingle(),
          ]);

        if (materialsResult.error) throw materialsResult.error;

        let practiceAvailable = false;

        if (practiceResult.ok) {
          const practiceData = await practiceResult.json();
          practiceAvailable = (practiceData.courses || []).some(
            (practiceCourse) => practiceCourse.code === courseData.code
          );
        }

        if (!isMounted) return;

        setCourse(courseData);
        setMaterials(materialsResult.data || []);
        setOutline(outlineResult.error ? null : outlineResult.data);
        setHasPractice(practiceAvailable);
      } catch (fetchError) {
        console.error("Error fetching course page:", fetchError);

        if (isMounted) {
          setError("This course could not be loaded right now.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchCoursePage();

    return () => {
      isMounted = false;
    };
  }, [id]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  if (loading) {
    return (
      <div className="swift-loading-screen">
        <span className="swift-loading-mark">S</span>
        <p>Opening course materials...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <AppShell onSignOut={handleSignOut}>
        <div className="swift-page course-error-page">
          <button
            type="button"
            className="swift-back-button"
            onClick={() => navigate(-1)}
          >
            <span aria-hidden="true">←</span> Back
          </button>
          <div className="level-message is-error">
            {error || "Course not found."}
          </div>
        </div>
      </AppShell>
    );
  }

  const materialSections = MATERIAL_SECTIONS.map((section) => ({
    ...section,
    materials: sortMaterials(
      materials.filter(
        (material) => getMaterialSection(material) === section.key
      )
    ),
  })).filter((section) => section.materials.length > 0);

  return (
    <AppShell onSignOut={handleSignOut}>
      <div className="swift-page course-page">
        <button
          type="button"
          className="swift-back-button"
          onClick={() => navigate(`/level/${course.level}`)}
        >
          <span aria-hidden="true">←</span> {course.level} Level
        </button>

        <section className="course-intro">
          <p className="swift-eyebrow">
            {course.level} Level · {course.code}
          </p>
          <h1>{course.title}</h1>
          {course.description && <p>{course.description}</p>}
        </section>

        <section className="course-actions" aria-label="Course actions">
          <div>
            <p className="course-action-label">Practice</p>
            <p className="course-action-copy">
              {hasPractice
                ? "Curated question banks are available for this course."
                : "A curated question bank has not been added for this course yet."}
            </p>
          </div>

          {hasPractice ? (
            <button
              type="button"
              className="swift-primary-button"
              onClick={() =>
                navigate(`/test/${encodeURIComponent(course.code)}`)
              }
            >
              Start practice <span aria-hidden="true">→</span>
            </button>
          ) : (
            <button
              type="button"
              className="course-library-link"
              onClick={() => navigate("/practice")}
            >
              Browse practice <span aria-hidden="true">→</span>
            </button>
          )}
        </section>

        <CourseOutline outline={outline} />

        <section className="course-materials">
          <div className="course-materials-heading">
            <div>
              <p className="swift-eyebrow">Study materials</p>
              <h2>Your course collection.</h2>
            </div>
            <p>{materials.length} materials</p>
          </div>

          {materials.length === 0 ? (
            <div className="level-message">
              Materials have not been added for this course yet.
            </div>
          ) : (
            <div className="material-category-list">
              {materialSections.map((section) => (
                <section
                  key={section.key}
                  className="material-category-section"
                  aria-labelledby={`material-category-${section.key}`}
                >
                  <div className="material-category-heading">
                    <div>
                      <h3 id={`material-category-${section.key}`}>
                        {section.label}
                      </h3>
                      <p>{section.description}</p>
                    </div>
                    <span>{section.materials.length}</span>
                  </div>

                  <div className="material-list">
                    {section.materials.map((material, index) => (
                      <MaterialRow
                        key={material.id}
                        material={material}
                        index={index}
                        onOpen={(materialId) => navigate(`/view/${materialId}`)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
