import { supabase } from "../lib/supabase";
import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://swift-md.vercel.app/reset-password",
    });

    if (error) {
      setError(error.message);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
        <div className="text-4xl mb-4">📬</div>
        <h2 className="text-2xl font-black text-white mb-2">
          Check your email
        </h2>
        <p className="text-gray-400 text-sm max-w-xs">
          We sent a password reset link to{" "}
          <span className="text-white font-bold">{email}</span>. Click it to
          reset your password.
        </p>
        <button
          onClick={() => navigate("/signin")}
          className="mt-6 border border-gray-700 text-white text-sm font-bold py-2 px-6 rounded-xl hover:bg-gray-800 transition-colors"
        >
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        onClick={() => navigate("/signin")}
        className="absolute top-6 left-6 text-gray-500 hover:text-white text-sm font-bold transition-colors"
      >
        ← Back
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8"
      >
        <div className="mb-8">
          <h2 className="text-2xl font-black text-white">Reset password</h2>
          <p className="text-gray-500 text-sm mt-1">
            Enter your email and we'll send a reset link.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              placeholder="you@example.com"
              className="bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {error && <p className="text-red-400 text-xs font-bold">{error}</p>}

          <button
            onClick={handleSubmit}
            className="bg-white text-gray-950 font-black py-3 rounded-xl hover:bg-gray-200 transition-colors mt-2"
          >
            Send Reset Link
          </button>
        </div>
      </motion.div>
    </div>
  );
}
