import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AppShell from "../components/AppShell";

const MODE_LABELS = {
  mcq: "Multiple choice",
  german: "Fill in the blank",
  theory: "Theory",
};

export default function PracticePage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPracticeCourses() {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/practice-courses`
        );

        if (!response.ok) {
          throw new Error("Practice courses request failed");
        }

        const data = await response.json();
        setCourses(data.courses || []);
      } catch {
        setError(
          "Practice is unavailable right now. Please check your connection and try again."
        );
      } finally {
        setLoading(false);
      }
    }

    loadPracticeCourses();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  const levels = [...new Set(courses.map((course) => course.level).filter(Boolean))].sort(
    (a, b) => a - b
  );

  const visibleCourses =
    selectedLevel === "all"
      ? courses
      : courses.filter((course) => course.level === Number(selectedLevel));

  return (
    <AppShell onSignOut={handleSignOut}>
      <div className="swift-page practice-page">
        <section className="practice-intro">
          <p className="swift-eyebrow">Curated practice</p>
          <h1>Practise from questions worth your time.</h1>
          <p>
            These courses have existing question banks built from the materials
            on Swift. Choose one to select a quiz mode and begin.
          </p>
        </section>

        {loading ? (
          <div className="practice-status">
            <span className="swift-loading-mark">S</span>
            <p>Finding available practice...</p>
          </div>
        ) : error ? (
          <div className="practice-status is-error">
            <p>{error}</p>
            <button type="button" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="practice-filter" role="group" aria-label="Filter by level">
              <button
                type="button"
                onClick={() => setSelectedLevel("all")}
                className={selectedLevel === "all" ? "is-selected" : ""}
              >
                All levels
              </button>

              {levels.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSelectedLevel(String(level))}
                  className={selectedLevel === String(level) ? "is-selected" : ""}
                >
                  {level} Level
                </button>
              ))}
            </div>

            {visibleCourses.length === 0 ? (
              <p className="practice-empty">
                No question banks are available for this level yet.
              </p>
            ) : (
              <div className="practice-course-list">
                {visibleCourses.map((course) => (
                  <article key={course.code} className="practice-course-row">
                    <div className="practice-course-main">
                      <p className="practice-course-code">
                        {course.level ? `${course.level} Level · ` : ""}
                        {course.code}
                      </p>
                      <h2>{course.title}</h2>
                      <div className="practice-mode-list">
                        {course.banks.map((bank) => (
                          <span key={bank.type}>
                            {MODE_LABELS[bank.type] || bank.type} ·{" "}
                            {bank.question_count} questions
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="practice-start-button"
                      onClick={() =>
                        navigate(`/test/${encodeURIComponent(course.code)}`)
                      }
                    >
                      Practise <span aria-hidden="true">→</span>
                    </button>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
