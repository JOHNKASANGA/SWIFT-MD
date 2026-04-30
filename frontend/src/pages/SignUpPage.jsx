import { supabase } from "../lib/supabase"
import { motion } from "framer-motion"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function SignUpPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError("")
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password || !form.confirmPassword) {
      setError("All fields are required.")
      return
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: "https://swift-md.vercel.app/home",
        data: {
          full_name: form.name
        }
      }

    })

    if (error) {
      setError(error.message)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
        <div className="text-4xl mb-4">📬</div>
        <h2 className="text-2xl font-black text-white mb-2">Check your email</h2>
        <p className="text-gray-400 text-sm max-w-xs">
          We sent a confirmation link to{" "}
          <span className="text-white font-bold">{form.email}</span>. Click it to activate your account.
        </p>
        <button
          onClick={() => window.location.href = "mailto:"}
          className="mt-6 border border-gray-700 text-white text-sm font-bold py-2 px-6 rounded-xl hover:bg-gray-800 transition-colors"
        >
          Open email app
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">

      {/* Back button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 text-gray-500 hover:text-white text-sm font-bold transition-colors"
      >
        ← Back
      </motion.button>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8"
      >
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-black text-white">Create account</h2>
          <p className="text-gray-500 text-sm mt-1">Join Swift. Start studying better.</p>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Full Name
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="David Gilbert"
              className="bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Min. 6 characters"
              className="bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat your password"
              className="bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-xs font-bold">{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            className="bg-white text-gray-950 font-black py-3 rounded-xl hover:bg-gray-200 transition-colors mt-2"
          >
            Create Account
          </button>

        </div>

        {/* Footer link */}
        <p className="text-gray-600 text-xs text-center mt-6">
          Already have an account?{" "}
          <span
            onClick={() => navigate("/signin")}
            className="text-white font-bold cursor-pointer hover:underline"
          >
            Sign in
          </span>
        </p>

      </motion.div>
    </div>
  )
}