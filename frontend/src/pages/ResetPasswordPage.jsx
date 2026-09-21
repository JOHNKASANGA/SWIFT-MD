import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AuthFrame from "../components/AuthFrame";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!password || !confirmPassword) {
      setError("Complete both password fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Your password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.updateUser({ password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    navigate("/signin");
  }

  if (!ready) {
    return (
      <div className="swift-loading-screen">
        <span className="swift-loading-mark">S</span>
        <p>Verifying your reset link...</p>
      </div>
    );
  }

  return (
    <AuthFrame
      title="Choose a new password."
      description="Use a password you have not used elsewhere."
      showBack={false}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />
        </label>

        <label>
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setError("");
            }}
            placeholder="Repeat your password"
            autoComplete="new-password"
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="auth-submit-button" disabled={loading}>
          {loading ? "Updating password..." : "Update password"}
        </button>
      </form>
    </AuthFrame>
  );
}
