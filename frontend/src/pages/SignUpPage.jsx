import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AuthFrame from "../components/AuthFrame";
import GoogleMark from "../components/GoogleMark";

export default function SignUpPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
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

    if (!form.name || !form.email || !form.password || !form.confirmPassword) {
      setError("Complete every field to create your account.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    if (form.password.length < 6) {
      setError("Your password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);

    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: "https://swift-md.vercel.app/home",
        data: { full_name: form.name },
      },
    });

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <AuthFrame
        title="Check your email."
        description={`We sent an account confirmation link to ${form.email}. Open it to activate Swift.`}
        footer={
          <>
            Already confirmed? <Link to="/signin">Sign in</Link>
          </>
        }
      >
        <p className="auth-success-copy">
          Check spam too, then mark the confirmation email as safe if it lands
          there.
        </p>
        <a className="auth-secondary-button" href="mailto:">
          Open email app
        </a>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Set up your study space."
      description="Create one account for your materials, curated practice, and academic tools."
      footer={
        <>
          Already have an account? <Link to="/signin">Sign in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Full name
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="David Gilbert"
            autoComplete="name"
          />
        </label>

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
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />
        </label>

        <label>
          Confirm password
          <input
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder="Repeat your password"
            autoComplete="new-password"
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button
          type="submit"
          className="auth-submit-button"
          disabled={submitting}
        >
          {submitting ? "Creating account..." : "Create account"}
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
