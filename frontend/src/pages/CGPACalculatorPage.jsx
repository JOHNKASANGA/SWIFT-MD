import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedBackground from "../components/AnimatedBackground";

const GRADE_POINTS = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
const GRADES = ["A", "B", "C", "D", "E", "F"];

function makeEmptyCourse() {
  return { id: crypto.randomUUID(), name: "", units: "", grade: "A" };
}

function makeEmptySemester(label) {
  return { id: crypto.randomUUID(), label, courses: [makeEmptyCourse()] };
}

function classOfDegree(cgpa) {
  if (cgpa >= 4.5) return "First Class";
  if (cgpa >= 3.5) return "Second Class Upper";
  if (cgpa >= 2.4) return "Second Class Lower";
  if (cgpa >= 1.5) return "Third Class";
  return "Pass";
}

function computeSemesterStats(courses) {
  const valid = courses.filter(
    (c) => c.units !== "" && !isNaN(c.units) && parseFloat(c.units) > 0
  );
  const units = valid.reduce((sum, c) => sum + parseFloat(c.units), 0);
  const points = valid.reduce(
    (sum, c) => sum + parseFloat(c.units) * GRADE_POINTS[c.grade],
    0
  );
  return { units, points, gpa: units > 0 ? points / units : 0 };
}

export default function CGPACalculatorPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // "fresh" | "continue" | null
  const [showHelp, setShowHelp] = useState(false);

  // ── "Continue" mode state ──
  const [prevCGPA, setPrevCGPA] = useState("");
  const [prevUnits, setPrevUnits] = useState("");
  const [courses, setCourses] = useState([makeEmptyCourse()]);
  const [continueResult, setContinueResult] = useState(null);
  const [continueError, setContinueError] = useState("");

  // ── "Fresh" (build from scratch) mode state ──
  const [semesters, setSemesters] = useState([
    makeEmptySemester("100L First Semester"),
  ]);

  function updateCourse(list, setList, id, field, value) {
    setList(list.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  // Continue mode handlers
  function updateContinueCourse(id, field, value) {
    updateCourse(courses, setCourses, id, field, value);
    setContinueResult(null);
  }
  function addContinueCourse() {
    setCourses([...courses, makeEmptyCourse()]);
    setContinueResult(null);
  }
  function removeContinueCourse(id) {
    if (courses.length === 1) return;
    setCourses(courses.filter((c) => c.id !== id));
    setContinueResult(null);
  }

  function calculateContinue() {
    setContinueError("");
    const stats = computeSemesterStats(courses);
    if (stats.units === 0) {
      setContinueError("Add at least one course with a unit value.");
      return;
    }

    const hasPrev = prevCGPA !== "" && prevUnits !== "";
    let newCGPA = stats.gpa;
    let totalUnits = stats.units;

    if (hasPrev) {
      const pCGPA = parseFloat(prevCGPA);
      const pUnits = parseFloat(prevUnits);
      if (
        isNaN(pCGPA) ||
        isNaN(pUnits) ||
        pUnits < 0 ||
        pCGPA < 0 ||
        pCGPA > 5
      ) {
        setContinueError("Enter a valid previous CGPA (0–5) and total units.");
        return;
      }
      totalUnits = pUnits + stats.units;
      newCGPA = (pCGPA * pUnits + stats.points) / totalUnits;
    }

    setContinueResult({
      semesterGPA: stats.gpa.toFixed(2),
      semesterUnits: stats.units,
      newCGPA: newCGPA.toFixed(2),
      totalUnits,
      hasPrev,
    });
  }

  // Fresh mode handlers
  function updateSemesterLabel(id, label) {
    setSemesters(semesters.map((s) => (s.id === id ? { ...s, label } : s)));
  }
  function updateFreshCourse(semId, courseId, field, value) {
    setSemesters(
      semesters.map((s) =>
        s.id === semId
          ? {
              ...s,
              courses: s.courses.map((c) =>
                c.id === courseId ? { ...c, [field]: value } : c
              ),
            }
          : s
      )
    );
  }
  function addFreshCourse(semId) {
    setSemesters(
      semesters.map((s) =>
        s.id === semId
          ? { ...s, courses: [...s.courses, makeEmptyCourse()] }
          : s
      )
    );
  }
  function removeFreshCourse(semId, courseId) {
    setSemesters(
      semesters.map((s) => {
        if (s.id !== semId) return s;
        if (s.courses.length === 1) return s;
        return { ...s, courses: s.courses.filter((c) => c.id !== courseId) };
      })
    );
  }
  function addSemester() {
    const nextLabel = `Semester ${semesters.length + 1}`;
    setSemesters([...semesters, makeEmptySemester(nextLabel)]);
  }
  function removeSemester(id) {
    if (semesters.length === 1) return;
    setSemesters(semesters.filter((s) => s.id !== id));
  }

  // Running cumulative totals across all semesters entered so far, live
  const freshRunning = semesters.reduce(
    (acc, sem) => {
      const stats = computeSemesterStats(sem.courses);
      return {
        units: acc.units + stats.units,
        points: acc.points + stats.points,
      };
    },
    { units: 0, points: 0 }
  );
  const freshCGPA =
    freshRunning.units > 0 ? freshRunning.points / freshRunning.units : 0;

  // ── Mode picker screen ──
  if (!mode) {
    return (
      <div className="min-h-screen bg-gray-950 px-6 py-10 max-w-2xl mx-auto">
        <AnimatedBackground />
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <button
            onClick={() => navigate("/home")}
            className="text-gray-500 hover:text-white text-sm font-bold transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-white font-black text-2xl">CGPA Calculator</h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-gray-400 text-sm mb-8"
        >
          First, tell us where you're starting from.
        </motion.p>

        <div className="flex flex-col gap-4">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => setMode("fresh")}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left hover:border-gray-600 transition-colors"
          >
            <p className="text-white font-black text-lg mb-1">
              I'm starting from scratch
            </p>
            <p className="text-gray-500 text-sm">
              You've never calculated a CGPA before, or want to rebuild it from
              your very first semester onward, one semester at a time.
            </p>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => setMode("continue")}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left hover:border-gray-600 transition-colors"
          >
            <p className="text-white font-black text-lg mb-1">
              I already know my CGPA
            </p>
            <p className="text-gray-500 text-sm">
              You know your current CGPA and total units, and just want to add
              one new semester on top of it.
            </p>
          </motion.button>
        </div>
      </div>
    );
  }

  // ── "Continue" mode screen ──
  if (mode === "continue") {
    return (
      <div className="min-h-screen bg-gray-950 px-6 py-10 max-w-2xl mx-auto">
        <AnimatedBackground />
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setMode(null)}
            className="text-gray-500 hover:text-white text-sm font-bold transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-white font-black text-2xl">Add a Semester</h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4">
            Your Current Record
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-500 text-xs font-bold mb-1 block">
                Current CGPA
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="5"
                value={prevCGPA}
                onChange={(e) => {
                  setPrevCGPA(e.target.value);
                  setContinueResult(null);
                }}
                placeholder="e.g. 4.20"
                className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs font-bold mb-1 block">
                Total Units So Far
              </label>
              <input
                type="number"
                min="0"
                value={prevUnits}
                onChange={(e) => {
                  setPrevUnits(e.target.value);
                  setContinueResult(null);
                }}
                placeholder="e.g. 90"
                className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4">
          New Semester's Courses
        </p>
        <div className="flex flex-col gap-3 mb-3">
          {courses.map((course, i) => (
            <div
              key={course.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex gap-3 items-center"
            >
              <input
                type="text"
                value={course.name}
                onChange={(e) =>
                  updateContinueCourse(course.id, "name", e.target.value)
                }
                placeholder={`Course ${i + 1} (optional)`}
                className="flex-1 bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors min-w-0"
              />
              <input
                type="number"
                min="1"
                value={course.units}
                onChange={(e) =>
                  updateContinueCourse(course.id, "units", e.target.value)
                }
                placeholder="Units"
                className="w-20 bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
              <select
                value={course.grade}
                onChange={(e) =>
                  updateContinueCourse(course.id, "grade", e.target.value)
                }
                className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeContinueCourse(course.id)}
                disabled={courses.length === 1}
                className="text-gray-600 hover:text-red-400 disabled:opacity-20 transition-colors text-lg font-bold px-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addContinueCourse}
          className="w-full border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 font-bold py-3 rounded-xl transition-colors text-sm mb-6"
        >
          + Add Course
        </button>

        {continueError && (
          <p className="text-red-400 text-xs font-bold mb-4">{continueError}</p>
        )}

        <button
          onClick={calculateContinue}
          className="w-full bg-white text-gray-950 font-black py-3 rounded-xl hover:bg-gray-200 transition-colors mb-6"
        >
          Calculate
        </button>

        {continueResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6"
          >
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">
              This Semester's GPA
            </p>
            <p className="text-white font-black text-4xl mb-1">
              {continueResult.semesterGPA}
              <span className="text-gray-500 text-lg">/5.00</span>
            </p>
            <p className="text-gray-600 text-xs mb-6">
              {continueResult.semesterUnits} units this semester
            </p>

            <div className="h-px bg-gray-800 mb-6" />
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">
              New Cumulative CGPA
            </p>
            <p className="text-white font-black text-4xl mb-1">
              {continueResult.newCGPA}
              <span className="text-gray-500 text-lg">/5.00</span>
            </p>
            <p className="text-gray-600 text-xs mb-4">
              {continueResult.totalUnits} total units
            </p>
            <div className="bg-gray-800 rounded-xl px-4 py-3">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">
                Class of Degree
              </p>
              <p className="text-white font-black text-lg">
                {classOfDegree(parseFloat(continueResult.newCGPA))}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  // ── "Fresh" (build from scratch) mode screen ──
  return (
    <div className="min-h-screen bg-gray-950 px-6 py-10 max-w-2xl mx-auto">
      <AnimatedBackground />
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setMode(null)}
          className="text-gray-500 hover:text-white text-sm font-bold transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-white font-black text-2xl">Build Your CGPA</h1>
      </div>

      <button
        onClick={() => setShowHelp(!showHelp)}
        className="text-gray-500 hover:text-white text-xs font-bold mb-4 flex items-center gap-1"
      >
        {showHelp ? "Hide" : "How does this work?"}
      </button>

      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6 text-sm text-gray-400 leading-relaxed">
              <p className="mb-2">
                <span className="text-white font-bold">
                  Add one semester at a time
                </span>
                , starting from your very first semester (e.g. 100L First
                Semester), in the order you actually took them.
              </p>
              <p className="mb-2">
                For each semester, list every course you took that session, its
                unit load, and the grade you got. Once you've entered a
                semester, tap{" "}
                <span className="text-white font-bold">+ Add Semester</span> to
                move on to the next one.
              </p>
              <p>
                Your running CGPA updates automatically at the bottom as you go
                — by the time you've entered your most recent semester, that
                number is your actual current CGPA.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-5 mb-4">
        {semesters.map((sem, semIndex) => {
          const stats = computeSemesterStats(sem.courses);
          return (
            <div
              key={sem.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <input
                  type="text"
                  value={sem.label}
                  onChange={(e) => updateSemesterLabel(sem.id, e.target.value)}
                  className="bg-transparent text-white font-black text-base focus:outline-none border-b border-transparent focus:border-gray-600 transition-colors"
                />
                {semesters.length > 1 && (
                  <button
                    onClick={() => removeSemester(sem.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-xs font-bold"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2 mb-3">
                {sem.courses.map((course, i) => (
                  <div key={course.id} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={course.name}
                      onChange={(e) =>
                        updateFreshCourse(
                          sem.id,
                          course.id,
                          "name",
                          e.target.value
                        )
                      }
                      placeholder={`Course ${i + 1} (optional)`}
                      className="flex-1 bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors min-w-0"
                    />
                    <input
                      type="number"
                      min="1"
                      value={course.units}
                      onChange={(e) =>
                        updateFreshCourse(
                          sem.id,
                          course.id,
                          "units",
                          e.target.value
                        )
                      }
                      placeholder="Units"
                      className="w-16 bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <select
                      value={course.grade}
                      onChange={(e) =>
                        updateFreshCourse(
                          sem.id,
                          course.id,
                          "grade",
                          e.target.value
                        )
                      }
                      className="bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      {GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeFreshCourse(sem.id, course.id)}
                      disabled={sem.courses.length === 1}
                      className="text-gray-600 hover:text-red-400 disabled:opacity-20 transition-colors text-base font-bold px-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => addFreshCourse(sem.id)}
                className="w-full border border-gray-800 text-gray-500 hover:text-white hover:border-gray-600 font-bold py-2 rounded-lg transition-colors text-xs mb-3"
              >
                + Add Course
              </button>

              {stats.units > 0 && (
                <p className="text-gray-500 text-xs">
                  This semester:{" "}
                  <span className="text-white font-bold">
                    {stats.gpa.toFixed(2)}
                  </span>{" "}
                  GPA over {stats.units} units
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={addSemester}
        className="w-full bg-gray-900 border border-gray-700 text-white font-bold py-3 rounded-xl hover:border-gray-500 transition-colors mb-6"
      >
        + Add Semester
      </button>

      {freshRunning.units > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6"
        >
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">
            Running CGPA ({semesters.length} semester
            {semesters.length > 1 ? "s" : ""} entered)
          </p>
          <p className="text-white font-black text-4xl mb-1">
            {freshCGPA.toFixed(2)}
            <span className="text-gray-500 text-lg">/5.00</span>
          </p>
          <p className="text-gray-600 text-xs mb-4">
            {freshRunning.units} total units
          </p>
          <div className="bg-gray-800 rounded-xl px-4 py-3">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">
              Class of Degree
            </p>
            <p className="text-white font-black text-lg">
              {classOfDegree(freshCGPA)}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
