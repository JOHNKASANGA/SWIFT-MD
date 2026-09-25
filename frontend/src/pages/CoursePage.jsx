import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AppShell from "../components/AppShell";

const MATERIAL_PRIORITY = {
  start_here: { label: "Start here", rank: 0 },
  core: { label: "Core", rank: 1 },
  recommended: { label: "Recommended", rank: 2 },
  supplementary: { label: "Supplementary", rank: 3 },
  reference: { label: "Reference", rank: 4 },
  unreviewed: { label: null, rank: 5 },
};

function getMaterialPriority(material) {
  return MATERIAL_PRIORITY[material.material_priority] ||
    MATERIAL_PRIORITY.unreviewed;
}

function sortMaterialsByPriority(materials) {
  return [...materials].sort((first, second) => {
    const priorityDifference =
      getMaterialPriority(first).rank - getMaterialPriority(second).rank;

    if (priorityDifference !== 0) return priorityDifference;

    const firstOrder = Number.isInteger(first.material_sort_order)
      ? first.material_sort_order
      : Number.MAX_SAFE_INTEGER;
    const secondOrder = Number.isInteger(second.material_sort_order)
      ? second.material_sort_order
      : Number.MAX_SAFE_INTEGER;

    if (firstOrder !== secondOrder) return firstOrder - secondOrder;

    return first.title.localeCompare(second.title, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function MaterialRow({ material, index, onOpen }) {
  const priority = getMaterialPriority(material);

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

        {priority.label && (
          <span
            className={
              priority.label === "Start here"
                ? "material-priority is-start-here"
                : "material-priority"
            }
          >
            {priority.label}
          </span>
        )}

        {material.priority_reason && (
          <span className="material-priority-reason">
            {material.priority_reason}
          </span>
        )}
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

  const sortedMaterials = sortMaterialsByPriority(materials);
  const startHereMaterials = sortedMaterials.filter(
    (material) => material.material_priority === "start_here"
  );
  const remainingMaterials = sortedMaterials.filter(
    (material) => material.material_priority !== "start_here"
  );

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

        {startHereMaterials.length > 0 && (
          <section className="material-priority-section">
            <div className="material-priority-heading">
              <div>
                <p className="swift-eyebrow">Recommended order</p>
                <h2>Start here.</h2>
              </div>
              <p>
                These materials were reviewed as the strongest place to begin.
              </p>
            </div>

            <div className="material-list">
              {startHereMaterials.map((material, index) => (
                <MaterialRow
                  key={material.id}
                  material={material}
                  index={index}
                  onOpen={(materialId) => navigate(`/view/${materialId}`)}
                />
              ))}
            </div>
          </section>
        )}

        <section className="course-materials">
          <div className="course-materials-heading">
            <div>
              <p className="swift-eyebrow">Study materials</p>
              <h2>
                {startHereMaterials.length > 0
                  ? "Everything else."
                  : "Your course collection."}
              </h2>
            </div>
            <p>{materials.length} materials</p>
          </div>

          {materials.length === 0 ? (
            <div className="level-message">
              Materials have not been added for this course yet.
            </div>
          ) : (
            <>
              {startHereMaterials.length === 0 && (
                <p className="material-review-note">
                  Materials will appear in reviewed priority order as the course
                  collection is checked.
                </p>
              )}

              <div className="material-list">
                {remainingMaterials.map((material, index) => (
                  <MaterialRow
                    key={material.id}
                    material={material}
                    index={index + startHereMaterials.length}
                    onOpen={(materialId) => navigate(`/view/${materialId}`)}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
