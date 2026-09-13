import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AnimatedBackground from "../components/AnimatedBackground";

const GRADE_POINTS = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
const GRADES = ["A", "B", "C", "D", "E", "F"];

function makeEmptyCourse() {
  return { id: crypto.randomUUID(), name: "", units: "", grade: "A" };
}

export default function CGPACalculatorPage() {
  const navigate = useNavigate();

  const [prevCGPA, setPrevCGPA] = useState("");
  const [prevUnits, setPrevUnits] = useState("");
  const [courses, setCourses] = useState([makeEmptyCourse()]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function updateCourse(id, field, value) {
    setCourses(
      courses.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
    setResult(null);
  }

  function addCourse() {
    setCourses([...courses, makeEmptyCourse()]);
    setResult(null);
  }

  function removeCourse(id) {
    if (courses.length === 1) return;
    setCourses(courses.filter((c) => c.id !== id));
    setResult(null);
  }

  function calculate() {
    setError("");

    const validCourses = courses.filter(
      (c) => c.units !== "" && !isNaN(c.units)
    );
    if (validCourses.length === 0) {
      setError("Add at least one course with a unit value.");
      return;
    }

    let semesterUnits = 0;
    let semesterPoints = 0;
    for (const c of validCourses) {
      const units = parseFloat(c.units);
      if (units <= 0) {
        setError("Units must be greater than zero.");
        return;
      }
      semesterUnits += units;
      semesterPoints += units * GRADE_POINTS[c.grade];
    }

    const semesterGPA = semesterPoints / semesterUnits;

    const hasPrev = prevCGPA !== "" && prevUnits !== "";
    let newCGPA = semesterGPA;
    let totalUnits = semesterUnits;

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
        setError("Enter a valid previous CGPA (0–5) and total units.");
        return;
      }
      const prevPoints = pCGPA * pUnits;
      totalUnits = pUnits + semesterUnits;
      newCGPA = (prevPoints + semesterPoints) / totalUnits;
    }

    setResult({
      semesterGPA: semesterGPA.toFixed(2),
      semesterUnits,
      newCGPA: newCGPA.toFixed(2),
      totalUnits,
      hasPrev,
    });
  }

  function classOfDegree(cgpa) {
    if (cgpa >= 4.5) return "First Class";
    if (cgpa >= 3.5) return "Second Class Upper";
    if (cgpa >= 2.4) return "Second Class Lower";
    if (cgpa >= 1.5) return "Third Class";
    return "Pass";
  }

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-10 max-w-2xl mx-auto">
      <AnimatedBackground />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
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

      {/* Previous record */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6"
      >
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4">
          Previous Record (optional)
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
                setResult(null);
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
                setResult(null);
              }}
              placeholder="e.g. 90"
              className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
        <p className="text-gray-600 text-xs mt-3">
          Leave both blank to just calculate this semester's GPA on its own.
        </p>
      </motion.div>

      {/* Course list */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-6"
      >
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4">
          This Semester's Courses
        </p>
        <div className="flex flex-col gap-3">
          {courses.map((course, i) => (
            <div
              key={course.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex gap-3 items-center"
            >
              <input
                type="text"
                value={course.name}
                onChange={(e) =>
                  updateCourse(course.id, "name", e.target.value)
                }
                placeholder={`Course ${i + 1} (optional)`}
                className="flex-1 bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors min-w-0"
              />
              <input
                type="number"
                min="1"
                value={course.units}
                onChange={(e) =>
                  updateCourse(course.id, "units", e.target.value)
                }
                placeholder="Units"
                className="w-20 bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
              <select
                value={course.grade}
                onChange={(e) =>
                  updateCourse(course.id, "grade", e.target.value)
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
                onClick={() => removeCourse(course.id)}
                disabled={courses.length === 1}
                className="text-gray-600 hover:text-red-400 disabled:opacity-20 disabled:hover:text-gray-600 transition-colors text-lg font-bold px-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addCourse}
          className="w-full mt-3 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 font-bold py-3 rounded-xl transition-colors text-sm"
        >
          + Add Course
        </button>
      </motion.div>

      {error && <p className="text-red-400 text-xs font-bold mb-4">{error}</p>}

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        onClick={calculate}
        className="w-full bg-white text-gray-950 font-black py-3 rounded-xl hover:bg-gray-200 transition-colors mb-6"
      >
        Calculate
      </motion.button>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6"
        >
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">
            This Semester's GPA
          </p>
          <p className="text-white font-black text-4xl mb-1">
            {result.semesterGPA}
            <span className="text-gray-500 text-lg">/5.00</span>
          </p>
          <p className="text-gray-600 text-xs mb-6">
            {result.semesterUnits} units this semester
          </p>

          {result.hasPrev && (
            <>
              <div className="h-px bg-gray-800 mb-6" />
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">
                New Cumulative CGPA
              </p>
              <p className="text-white font-black text-4xl mb-1">
                {result.newCGPA}
                <span className="text-gray-500 text-lg">/5.00</span>
              </p>
              <p className="text-gray-600 text-xs mb-4">
                {result.totalUnits} total units
              </p>
              <div className="bg-gray-800 rounded-xl px-4 py-3">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">
                  Class of Degree
                </p>
                <p className="text-white font-black text-lg">
                  {classOfDegree(parseFloat(result.newCGPA))}
                </p>
              </div>
            </>
          )}

          {!result.hasPrev && (
            <div className="bg-gray-800 rounded-xl px-4 py-3">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">
                Class of Degree (this semester)
              </p>
              <p className="text-white font-black text-lg">
                {classOfDegree(parseFloat(result.semesterGPA))}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
