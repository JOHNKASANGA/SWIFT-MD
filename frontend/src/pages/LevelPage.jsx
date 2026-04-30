import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import { supabase } from "../lib/supabase"

export default function LevelPage() {
    const { level } = useParams()
    const navigate = useNavigate()
    const [courses, setCourses] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchCourses() {
            const { data, error } = await supabase
                .from("courses")
                .select("*")
                .eq("level", level)

            if (!error) setCourses(data)
            setLoading(false)
        }

        fetchCourses()
    }, [level])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <p className="text-gray-500 text-sm font-bold animate-pulse">Loading...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-950 px-6 py-10 max-w-2xl mx-auto">

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex items-center gap-4 mb-12"
            >
                <button
                    onClick={() => navigate("/home")}
                    className="text-gray-500 hover:text-white text-sm font-bold transition-colors"
                >
                    ← Back
                </button>
                <h1 className="text-white font-black text-2xl">{level} Level</h1>
            </motion.div>

            {/* Course list */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-col gap-4"
            >
                {courses.length === 0 ? (
                    <p className="text-gray-500 text-sm">No courses found for this level.</p>
                ) : (
                    courses.map((course) => (
                        <button
                            key={course.id}
                            onClick={() => navigate(`/course/${course.id}`)}
                            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left hover:border-gray-600 transition-colors"
                        >
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">
                                {course.code}
                            </p>
                            <p className="text-white font-black text-lg mb-1">{course.title}</p>
                            <p className="text-gray-500 text-sm">{course.description}</p>
                        </button>
                    ))
                )}
            </motion.div>

        </div>
    )
}