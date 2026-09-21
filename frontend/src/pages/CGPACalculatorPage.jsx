import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { supabase } from "../lib/supabase";

const GRADE_POINTS = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
const GRADES = ["A", "B", "C", "D", "E", "F"];
const STORAGE_KEY = "swift-cgpa-draft-v2";

function createId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function makeEmptyCourse() {
  return { id: createId(), name: "", units: "", grade: "A" };
}

function semesterLabel(index) {
  const labels = [
    "100L First Semester",
    "100L Second Semester",
    "200L First Semester",
    "200L Second Semester",
    "300L First Semester",
    "300L Second Semester",
  ];

  return labels[index] || `Semester ${index + 1}`;
}

function makeEmptySemester(index) {
  return {
    id: createId(),
    label: semesterLabel(index),
    courses: [makeEmptyCourse()],
  };
}

function readDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (!saved) return null;

    return saved;
  } catch {
    return null;
  }
}

function classOfDegree(cgpa) {
  if (cgpa >= 4.5) return "First Class";
  if (cgpa >= 3.5) return "Second Class Upper";
  if (cgpa >= 2.4) return "Second Class Lower";
  if (cgpa >= 1.5) return "Third Class";
  return "Pass";
}

function computeSemesterStats(courses) {
  const validCourses = courses.filter((course) => {
    const units = Number(course.units);
    return Number.isFinite(units) && units > 0;
  });

  const units = validCourses.reduce(
    (sum, course) => sum + Number(course.units),
    0
  );

  const points = validCourses.reduce(
    (sum, course) => sum + Number(course.units) * GRADE_POINTS[course.grade],
    0
  );

  return {
    units,
    points,
    gpa: units > 0 ? points / units : 0,
  };
}

function ResultPanel({ title, cgpa, units, extra }) {
  return (
    <div className="cgpa-result-panel">
      <p>{title}</p>
      <strong>
        {cgpa.toFixed(2)}
        <span>/5.00</span>
      </strong>
      <small>{units} total units</small>
      {extra}
      <div className="cgpa-classification">
        <span>Current classification</span>
        <b>{classOfDegree(cgpa)}</b>
      </div>
    </div>
  );
}

function CourseRow({ course, index, onChange, onRemove, canRemove }) {
  return (
    <div className="cgpa-course-row">
      <span className="cgpa-course-index">{String(index + 1).padStart(2, "0")}</span>

      <input
        type="text"
        value={course.name}
        onChange={(event) => onChange("name", event.target.value)}
        placeholder="Course name or code"
        aria-label={`Course ${index + 1} name`}
      />

      <input
        type="number"
        min="1"
        inputMode="numeric"
        value={course.units}
        onChange={(event) => onChange("units", event.target.value)}
        placeholder="Units"
        aria-label={`Course ${index + 1} units`}
      />

      <select
        value={course.grade}
        onChange={(event) => onChange("grade", event.target.value)}
        aria-label={`Course ${index + 1} grade`}
      >
        {GRADES.map((grade) => (
          <option key={grade} value={grade}>
            {grade}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="cgpa-remove-button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Remove course ${index + 1}`}
      >
        ×
      </button>
    </div>
  );
}

export default function CGPACalculatorPage() {
  const navigate = useNavigate();
  const savedDraft = readDraft();

  const [mode, setMode] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [prevCGPA, setPrevCGPA] = useState(savedDraft?.prevCGPA || "");
  const [prevUnits, setPrevUnits] = useState(savedDraft?.prevUnits || "");
  const [continueCourses, setContinueCourses] = useState(
    savedDraft?.continueCourses?.length
      ? savedDraft.continueCourses
      : [makeEmptyCourse()]
  );
  const [continueResult, setContinueResult] = useState(null);
  const [continueError, setContinueError] = useState("");

  const [semesters, setSemesters] = useState(
    savedDraft?.semesters?.length ? savedDraft.semesters : [makeEmptySemester(0)]
  );

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        prevCGPA,
        prevUnits,
        continueCourses,
        semesters,
      })
    );
  }, [prevCGPA, prevUnits, continueCourses, semesters]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  function updateContinueCourse(id, field, value) {
    setContinueCourses((courses) =>
      courses.map((course) =>
        course.id === id ? { ...course, [field]: value } : course
      )
    );
    setContinueResult(null);
    setContinueError("");
  }

  function addContinueCourse() {
    setContinueCourses((courses) => [...courses, makeEmptyCourse()]);
    setContinueResult(null);
  }

  function removeContinueCourse(id) {
    setContinueCourses((courses) => {
      if (courses.length === 1) return courses;
      return courses.filter((course) => course.id !== id);
    });
    setContinueResult(null);
  }

  function calculateContinue() {
    setContinueError("");

    const stats = computeSemesterStats(continueCourses);

    if (stats.units === 0) {
      setContinueError("Add at least one course with a valid unit load.");
      return;
    }

    const enteredPreviousRecord = prevCGPA !== "" || prevUnits !== "";

    if (enteredPreviousRecord && (prevCGPA === "" || prevUnits === "")) {
      setContinueError("Enter both your previous CGPA and total units, or leave both blank.");
      return;
    }

    let cumulativeCGPA = stats.gpa;
    let totalUnits = stats.units;

    if (enteredPreviousRecord) {
      const parsedCGPA = Number(prevCGPA);
      const parsedUnits = Number(prevUnits);

      if (
        !Number.isFinite(parsedCGPA) ||
        !Number.isFinite(parsedUnits) ||
        parsedCGPA < 0 ||
        parsedCGPA > 5 ||
        parsedUnits < 0
      ) {
        setContinueError("Use a CGPA between 0 and 5, with a valid previous total unit value.");
        return;
      }

      totalUnits = parsedUnits + stats.units;
      cumulativeCGPA = (parsedCGPA * parsedUnits + stats.points) / totalUnits;
    }

    setContinueResult({
      semesterGPA: stats.gpa,
      semesterUnits: stats.units,
      cumulativeCGPA,
      totalUnits,
      hasPreviousRecord: enteredPreviousRecord,
    });
  }

  function updateSemesterLabel(id, label) {
    setSemesters((currentSemesters) =>
      currentSemesters.map((semester) =>
        semester.id === id ? { ...semester, label } : semester
      )
    );
  }

  function updateFreshCourse(semesterId, courseId, field, value) {
    setSemesters((currentSemesters) =>
      currentSemesters.map((semester) => {
        if (semester.id !== semesterId) return semester;

        return {
          ...semester,
          courses: semester.courses.map((course) =>
            course.id === courseId ? { ...course, [field]: value } : course
          ),
        };
      })
    );
  }

  function addFreshCourse(semesterId) {
    setSemesters((currentSemesters) =>
      currentSemesters.map((semester) =>
        semester.id === semesterId
          ? { ...semester, courses: [...semester.courses, makeEmptyCourse()] }
          : semester
      )
    );
  }

  function removeFreshCourse(semesterId, courseId) {
    setSemesters((currentSemesters) =>
      currentSemesters.map((semester) => {
        if (semester.id !== semesterId || semester.courses.length === 1) {
          return semester;
        }

        return {
          ...semester,
          courses: semester.courses.filter((course) => course.id !== courseId),
        };
      })
    );
  }

  function addSemester() {
    setSemesters((currentSemesters) => [
      ...currentSemesters,
      makeEmptySemester(currentSemesters.length),
    ]);
  }

  function removeSemester(id) {
    setSemesters((currentSemesters) => {
      if (currentSemesters.length === 1) return currentSemesters;
      return currentSemesters.filter((semester) => semester.id !== id);
    });
  }

  function resetCalculator() {
    localStorage.removeItem(STORAGE_KEY);
    setPrevCGPA("");
    setPrevUnits("");
    setContinueCourses([makeEmptyCourse()]);
    setContinueResult(null);
    setContinueError("");
    setSemesters([makeEmptySemester(0)]);
    setMode(null);
    setShowResetConfirm(false);
  }

  const freshRunning = semesters.reduce(
    (summary, semester) => {
      const stats = computeSemesterStats(semester.courses);

      return {
        units: summary.units + stats.units,
        points: summary.points + stats.points,
      };
    },
    { units: 0, points: 0 }
  );

  const freshCGPA =
    freshRunning.units > 0 ? freshRunning.points / freshRunning.units : 0;

  return (
    <AppShell onSignOut={handleSignOut}>
      <div className="swift-page cgpa-page">
        <button
          type="button"
          className="swift-back-button"
          onClick={() => (mode ? setMode(null) : navigate("/home"))}
        >
          <span aria-hidden="true">←</span> {mode ? "Calculator choices" : "Study space"}
        </button>

        <section className="cgpa-intro">
          <p className="swift-eyebrow">Academic tools</p>
          <h1>Know where you stand.</h1>
          <p>
            Calculate one semester, rebuild your cumulative CGPA, or continue
            from the record you already have.
          </p>
        </section>

        {mode === null && (
          <>
            <section className="cgpa-mode-grid">
              <button
                type="button"
                className="cgpa-mode-option"
                onClick={() => setMode("continue")}
              >
                <span className="cgpa-mode-number">01</span>
                <strong>Add a new semester</strong>
                <p>
                  You already know your CGPA and total units, and only need to
                  add your latest results.
                </p>
                <span>Continue from my record →</span>
              </button>

              <button
                type="button"
                className="cgpa-mode-option"
                onClick={() => setMode("fresh")}
              >
                <span className="cgpa-mode-number">02</span>
                <strong>Build from the beginning</strong>
                <p>
                  Enter every semester you have completed and Swift will keep
                  the running CGPA updated.
                </p>
                <span>Start from my first semester →</span>
              </button>
            </section>

            <section className="cgpa-guide-card">
              <div>
                <p className="swift-eyebrow">Which one should I use?</p>
                <h2>Most returning students should continue.</h2>
              </div>
              <div>
                <p>
                  If your portal or result slip shows both a CGPA and total
                  units, choose <b>Add a new semester</b>. You do not need to
                  type every old course again.
                </p>
                <button type="button" onClick={() => setShowGuide(!showGuide)}>
                  {showGuide ? "Hide example" : "Show an example"}
                </button>
              </div>

              {showGuide && (
                <div className="cgpa-guide-example">
                  <p>
                    Example: a student with a previous CGPA of <b>4.20</b> over{" "}
                    <b>90 units</b> enters only the courses from the new
                    semester. Swift combines both records automatically.
                  </p>
                </div>
              )}
            </section>
          </>
        )}

        {mode === "continue" && (
          <section className="cgpa-workspace">
            <div className="cgpa-workspace-heading">
              <div>
                <p className="swift-eyebrow">Add a new semester</p>
                <h2>Start from your current record.</h2>
              </div>
              <p>Saved automatically on this device.</p>
            </div>

            <div className="cgpa-record-card">
              <div>
                <label>
                  Previous CGPA
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.01"
                    value={prevCGPA}
                    onChange={(event) => {
                      setPrevCGPA(event.target.value);
                      setContinueResult(null);
                    }}
                    placeholder="e.g. 4.20"
                  />
                </label>
                <small>Leave blank only if this is your first semester.</small>
              </div>

              <div>
                <label>
                  Total units completed
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={prevUnits}
                    onChange={(event) => {
                      setPrevUnits(event.target.value);
                      setContinueResult(null);
                    }}
                    placeholder="e.g. 90"
                  />
                </label>
                <small>Use the total unit value beside your current CGPA.</small>
              </div>
            </div>

            <section className="cgpa-semester-section">
              <div className="cgpa-section-heading">
                <div>
                  <p className="swift-eyebrow">New semester</p>
                  <h3>Add your courses and grades.</h3>
                </div>
                <span>A = 5 · B = 4 · C = 3 · D = 2 · E = 1 · F = 0</span>
              </div>

              <div className="cgpa-course-table">
                {continueCourses.map((course, index) => (
                  <CourseRow
                    key={course.id}
                    course={course}
                    index={index}
                    canRemove={continueCourses.length > 1}
                    onChange={(field, value) =>
                      updateContinueCourse(course.id, field, value)
                    }
                    onRemove={() => removeContinueCourse(course.id)}
                  />
                ))}
              </div>

              <button
                type="button"
                className="cgpa-add-button"
                onClick={addContinueCourse}
              >
                + Add course
              </button>
            </section>

            {continueError && <p className="cgpa-error">{continueError}</p>}

            <button
              type="button"
              className="swift-primary-button cgpa-calculate-button"
              onClick={calculateContinue}
            >
              Calculate record <span aria-hidden="true">→</span>
            </button>

            {continueResult && (
              <div className="cgpa-continue-results">
                <div className="cgpa-semester-result">
                  <p>This semester</p>
                  <strong>
                    {continueResult.semesterGPA.toFixed(2)}
                    <span>/5.00</span>
                  </strong>
                  <small>{continueResult.semesterUnits} units entered</small>
                </div>

                <ResultPanel
                  title={
                    continueResult.hasPreviousRecord
                      ? "New cumulative CGPA"
                      : "Semester GPA"
                  }
                  cgpa={continueResult.cumulativeCGPA}
                  units={continueResult.totalUnits}
                />
              </div>
            )}
          </section>
        )}

        {mode === "fresh" && (
          <section className="cgpa-workspace">
            <div className="cgpa-workspace-heading">
              <div>
                <p className="swift-eyebrow">Build from the beginning</p>
                <h2>Add one completed semester at a time.</h2>
              </div>
              <p>Saved automatically on this device.</p>
            </div>

            <div className="cgpa-fresh-note">
              Begin with your earliest completed semester. The labels are only
              suggestions, so rename them if your own academic path differs.
            </div>

            <div className="cgpa-semester-stack">
              {semesters.map((semester, semesterIndex) => {
                const stats = computeSemesterStats(semester.courses);

                return (
                  <section key={semester.id} className="cgpa-semester-card">
                    <div className="cgpa-semester-card-header">
                      <div>
                        <span>{String(semesterIndex + 1).padStart(2, "0")}</span>
                        <input
                          type="text"
                          value={semester.label}
                          onChange={(event) =>
                            updateSemesterLabel(semester.id, event.target.value)
                          }
                          aria-label={`Semester ${semesterIndex + 1} label`}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeSemester(semester.id)}
                        disabled={semesters.length === 1}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="cgpa-course-table">
                      {semester.courses.map((course, courseIndex) => (
                        <CourseRow
                          key={course.id}
                          course={course}
                          index={courseIndex}
                          canRemove={semester.courses.length > 1}
                          onChange={(field, value) =>
                            updateFreshCourse(
                              semester.id,
                              course.id,
                              field,
                              value
                            )
                          }
                          onRemove={() =>
                            removeFreshCourse(semester.id, course.id)
                          }
                        />
                      ))}
                    </div>

                    <div className="cgpa-semester-card-footer">
                      <button
                        type="button"
                        className="cgpa-add-button"
                        onClick={() => addFreshCourse(semester.id)}
                      >
                        + Add course
                      </button>

                      {stats.units > 0 && (
                        <p>
                          Semester GPA: <b>{stats.gpa.toFixed(2)}</b> over{" "}
                          {stats.units} units
                        </p>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>

            <button
              type="button"
              className="cgpa-add-semester-button"
              onClick={addSemester}
            >
              + Add another semester
            </button>

            {freshRunning.units > 0 && (
              <ResultPanel
                title={`Running CGPA across ${semesters.length} semester${
                  semesters.length === 1 ? "" : "s"
                }`}
                cgpa={freshCGPA}
                units={freshRunning.units}
              />
            )}
          </section>
        )}

        {mode && (
          <section className="cgpa-reset-section">
            {showResetConfirm ? (
              <div>
                <p>
                  Clear every saved CGPA entry from this device? This cannot be
                  undone.
                </p>
                <button type="button" onClick={resetCalculator}>
                  Yes, clear calculator
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                >
                  Keep my entries
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
              >
                Clear saved calculator entries
              </button>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
