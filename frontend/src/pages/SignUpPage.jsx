import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function SignUpPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.email || !form.password || !form.confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    // Supabase wiring goes here later
    console.log("Submit:", form);
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
          <p className="text-gray-500 text-sm mt-1">
            Join Swift. Start studying better.
          </p>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4">
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
          {error && <p className="text-red-400 text-xs font-bold">{error}</p>}

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
  );
}
