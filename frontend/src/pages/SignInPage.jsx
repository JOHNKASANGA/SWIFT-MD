import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AuthFrame from "../components/AuthFrame";
import GoogleMark from "../components/GoogleMark";

export default function SignInPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
    setError("");
  }

  async function handleGoogleSignIn() {
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "https://swift-md.vercel.app/home" },
    });

    if (authError) setError(authError.message);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.email || !form.password) {
      setError("Enter your email and password to continue.");
      return;
    }

    setSubmitting(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    navigate("/home");
  }

  return (
    <AuthFrame
      title="Welcome back."
      description="Sign in and continue from the materials, practice, or calculator you need today."
      footer={
        <>
          New to Swift? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Your password"
            autoComplete="current-password"
          />
        </label>

        <Link className="auth-small-link" to="/forgot-password">
          Forgot password?
        </Link>

        {error && <p className="auth-error">{error}</p>}

        <button
          type="submit"
          className="auth-submit-button"
          disabled={submitting}
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="auth-divider">or</div>

      <button
        type="button"
        className="google-button"
        onClick={handleGoogleSignIn}
      >
        <GoogleMark />
        Continue with Google
      </button>
    </AuthFrame>
  );
}
