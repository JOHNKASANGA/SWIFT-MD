import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { supabase } from "../lib/supabase"

export default function HomePage() {
  const navigate = useNavigate()
  const [greeting, setGreeting] = useState("")
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate("/signin")
        return
      }
      setUser(user)

      const username = user.user_metadata?.full_name || user.email.split("@")[0]

      try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/generate-greeting`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username })
        })
        const data = await res.json()
        setGreeting(data.greeting.replace(/^#+\s*/, ""))
      } catch {
        setGreeting(`Welcome back, ${username}. Let's get to work.`)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate("/")
  }

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
        className="flex items-center justify-between mb-12"
      >
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-xl w-9 h-9 flex items-center justify-center">
            <span className="text-gray-950 font-black text-sm">S</span>
          </div>
          <span className="text-white font-black text-lg">Swift</span>
        </div>
        <button
          onClick={handleSignOut}
          className="text-gray-500 hover:text-white text-sm font-bold transition-colors"
        >
          Sign out
        </button>
      </motion.div>

      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-12"
      >
        <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mb-2">
          Good to see you
        </p>
        <p className="text-white text-xl font-bold leading-relaxed">
          {greeting}
        </p>
      </motion.div>

      {/* Level cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mb-4">
          Select your level
        </p>
        <div className="flex flex-col gap-4">

          <button
            onClick={() => navigate("/level/100")}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left hover:border-gray-600 transition-colors"
          >
            <p className="text-white font-black text-2xl mb-1">100 Level</p>
            <p className="text-gray-500 text-sm">First year courses and materials</p>
          </button>

          <button
            onClick={() => navigate("/level/200")}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left hover:border-gray-600 transition-colors"
          >
            <p className="text-white font-black text-2xl mb-1">200 Level</p>
            <p className="text-gray-500 text-sm">Second year courses and materials</p>
          </button>

        </div>
      </motion.div>

    </div>
  )
}