import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AuthFrame from "../components/AuthFrame";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email) {
      setError("Enter the email linked to your Swift account.");
      return;
    }

    setSubmitting(true);

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://swift-md.vercel.app/reset-password",
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
        description={`We sent a password-reset link to ${email}.`}
        footer={
          <>
            Back to <Link to="/signin">sign in</Link>
          </>
        }
      >
        <p className="auth-success-copy">
          Open the link in the same browser where you want to continue using
          Swift.
        </p>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Reset your password."
      description="Enter your email and we will send a secure reset link."
      footer={
        <>
          Remembered it? <Link to="/signin">Sign in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button
          type="submit"
          className="auth-submit-button"
          disabled={submitting}
        >
          {submitting ? "Sending link..." : "Send reset link"}
        </button>
      </form>
    </AuthFrame>
  );
}
