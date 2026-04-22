import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const circles = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  size: Math.random() * 60 + 20,
  x: Math.random() * 100,
  y: Math.random() * 100,
  duration: Math.random() * 10 + 8,
  delay: Math.random() * 5,
}));

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Animated background circles */}
      {circles.map((circle) => (
        <motion.div
          key={circle.id}
          className="absolute rounded-full bg-white opacity-5"
          style={{
            width: circle.size,
            height: circle.size,
            left: `${circle.x}%`,
            top: `${circle.y}%`,
          }}
          animate={{
            y: [-20, 20, -20],
            x: [-10, 10, -10],
            opacity: [0.03, 0.08, 0.03],
          }}
          transition={{
            duration: circle.duration,
            delay: circle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-10 z-10"
      >
        <h1 className="text-6xl font-black text-white tracking-tight">Swift</h1>
        <p className="text-gray-400 text-lg mt-3">Study smarter. Not harder.</p>
      </motion.div>

      {/* Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="flex flex-col gap-4 w-full max-w-xs z-10"
      >
        <button
          onClick={() => navigate("/signup")}
          className="bg-white text-gray-950 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
        >
          Get Started
        </button>
        <button
          onClick={() => navigate("/signin")}
          className="border border-gray-600 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors"
        >
          Sign In
        </button>
      </motion.div>
    </div>
  );
}
