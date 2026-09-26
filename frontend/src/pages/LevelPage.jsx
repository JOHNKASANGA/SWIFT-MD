import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AppShell from "../components/AppShell";

export default function LevelPage() {
  const { level } = useParams();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchCourses() {
      const { data, error: coursesError } = await supabase
        .from("courses")
        .select("*")
        .eq("level", level)
        .order("code", { ascending: true });

      if (coursesError) {
        setError("Courses could not be loaded right now.");
      } else {
        setCourses(data || []);
      }

      setLoading(false);
    }

    fetchCourses();
  }, [level]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  const departments = [...new Set(
    courses.map((course) => course.department).filter(Boolean)
  )].sort();

  const filteredCourses = courses.filter((course) => {
    const query = search.toLowerCase().trim();

    return (
      (!department || course.department === department) &&
      (course.title.toLowerCase().includes(query) ||
        course.code.toLowerCase().includes(query))
    );
  });

  return (
    <AppShell onSignOut={handleSignOut}>
      <div className="swift-page level-page">
        <button
          type="button"
          className="swift-back-button"
          onClick={() => navigate("/home")}
        >
          <span aria-hidden="true">←</span> Study space
        </button>

        <section className="level-intro">
          <p className="swift-eyebrow">Course library</p>
          <h1>{level} Level</h1>
          <p>
            Browse the courses, open the material collection for each one, and
            practise wherever a curated bank is available.
          </p>
        </section>

        <div className="level-toolbar">
          <label className="course-search">
            <span className="sr-only">Search courses</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by course name or code"
            />
          </label>

          {departments.length > 1 && (
            <label className="course-department-filter">
              <span className="sr-only">Filter by department</span>
              <select
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
              >
                <option value="">All departments</option>
                {departments.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
          )}

          <p className="course-count">
            {loading ? "Loading courses..." : `${filteredCourses.length} courses`}
          </p>
        </div>

        {error ? (
          <div className="level-message is-error">{error}</div>
        ) : loading ? (
          <div className="level-message">Loading your course library...</div>
        ) : filteredCourses.length === 0 ? (
          <div className="level-message">
            No courses match that search.
          </div>
        ) : (
          <div className="course-library-list">
            {filteredCourses.map((course) => (
              <button
                key={course.id}
                type="button"
                className="course-library-row"
                onClick={() => navigate(`/course/${course.id}`)}
              >
                <span className="course-library-code">{course.code}</span>
                <span className="course-library-content">
                  <strong>{course.title}</strong>
                  {course.department && <small>{course.department}</small>}
                  {course.description && <small>{course.description}</small>}
                </span>
                <span className="course-library-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
