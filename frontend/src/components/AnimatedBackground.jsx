import { motion } from "framer-motion";

const circles = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  size: Math.random() * 60 + 20,
  x: Math.random() * 100,
  y: Math.random() * 100,
  duration: Math.random() * 10 + 8,
  delay: Math.random() * 5,
}));

export default function AnimatedBackground() {
  return (
    <>
      {circles.map((circle) => (
        <motion.div
          key={circle.id}
          className="fixed rounded-full bg-white opacity-5 pointer-events-none"
          style={{
            width: circle.size,
            height: circle.size,
            left: `${circle.x}%`,
            top: `${circle.y}%`,
            zIndex: 0,
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
    </>
  );
}
