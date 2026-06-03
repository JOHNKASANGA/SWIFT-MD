import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import AnimatedBackground from "../components/AnimatedBackground";

export default function LevelPage() {
  const { level } = useParams();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses() {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("level", level)
        .order("code", { ascending: true });

      if (!error) setCourses(data);
      setLoading(false);
    }

    fetchCourses();
  }, [level]);

  const filtered = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm font-bold animate-pulse">
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-10 max-w-2xl mx-auto">
      <AnimatedBackground />
      {/* Header */}
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
        <h1 className="text-white font-black text-2xl">{level} Level</h1>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-6"
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by course name or code..."
          className="w-full bg-gray-900 border border-gray-800 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-600 transition-colors"
        />
      </motion.div>

      {/* Course list */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex flex-col gap-3"
      >
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-sm">No courses match your search.</p>
        ) : (
          filtered.map((course) => (
            <button
              key={course.id}
              onClick={() => navigate(`/course/${course.id}`)}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-left hover:border-gray-600 transition-colors"
            >
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">
                {course.code}
              </p>
              <p className="text-white font-black text-base mb-1">
                {course.title}
              </p>
              <p className="text-gray-600 text-xs">{course.description}</p>
            </button>
          ))
        )}
      </motion.div>
    </div>
  );
}
