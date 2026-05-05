import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import AnimatedBackground from "../components/AnimatedBackground";

export default function CoursePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // Added error state

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        setLoading(true);

        // 1. Fetch Course
        const { data: courseData, error: courseError } = await supabase
          .from("courses")
          .select("*")
          .eq("id", id)
          .single();

        if (courseError) throw courseError;

        if (isMounted) setCourse(courseData);

        // 2. Fetch Materials using the course code
        if (courseData?.code) {
          const { data: materialsData, error: matError } = await supabase
            .from("materials")
            .select("*")
            .eq("course_code", courseData.code);

          if (matError) throw matError;
          if (isMounted) setMaterials(materialsData || []);
        }
      } catch (err) {
        console.error("Error fetching course details:", err);
        if (isMounted) setError("Failed to load course details.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();
    return () => {
      isMounted = false;
    }; // Cleanup to prevent memory leaks
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm font-bold animate-pulse">
          Loading...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-red-500 text-sm">{error}</p>
        <button onClick={() => navigate(-1)} className="text-white underline">
          Go Back
        </button>
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
        className="flex items-center gap-4 mb-12"
      >
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-white text-sm font-bold transition-colors"
        >
          ← Back
        </button>
      </motion.div>

      {/* Course info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-10"
      >
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">
          {course?.code}
        </p>
        <h1 className="text-white font-black text-3xl mb-3">{course?.title}</h1>
        <p className="text-gray-500 text-sm">{course?.description}</p>
      </motion.div>

      {/* Materials */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-10"
      >
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4">
          Materials
        </p>

        {materials.length === 0 ? (
          <p className="text-gray-600 text-sm">No materials uploaded yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {materials.map((material) => (
              <div
                key={material.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center justify-between"
              >
                <div>
                  <p className="text-white font-bold text-sm">
                    {material.title}
                  </p>
                </div>

                {/* FIXED THE TAG BELOW */}
                <a
                  href={material.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="text-xs font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Download ↗
                </a>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Test Yourself */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <button
          onClick={() => navigate(`/test/${materials[0]?.id}`)}
          disabled={materials.length === 0}
          className="w-full bg-white text-gray-950 font-black py-4 rounded-2xl hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Test Yourself
        </button>
      </motion.div>
    </div>
  );
}
