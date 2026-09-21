import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import studyDeskImage from "../assets/swift-study-desk.png";

export default function WelcomePage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "INITIAL_SESSION") {
          if (session) {
            navigate("/home");
          } else {
            setChecking(false);
          }
        }

        if (event === "SIGNED_IN") {
          navigate("/home");
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  if (checking) {
    return (
      <div className="swift-loading-screen">
        <span className="swift-loading-mark">S</span>
        <p>Preparing Swift...</p>
      </div>
    );
  }

  return (
    <div className="welcome-page">
      <header className="public-header">
        <button
          type="button"
          className="swift-brand"
          onClick={() => navigate("/")}
          aria-label="Go to Swift home"
        >
          <span className="swift-brand-mark">S</span>
          <span>Swift</span>
        </button>

        <button
          type="button"
          className="public-header-link"
          onClick={() => navigate("/signin")}
        >
          Sign in
        </button>
      </header>

      <main className="welcome-main">
        <section className="welcome-copy">
          <p className="swift-eyebrow">For UNILAG Engineering</p>
          <h1>Your study system, built around your actual courses.</h1>
          <p>
            Find materials, practise with curated questions, and keep your
            academic tools in one clear place.
          </p>

          <div className="welcome-actions">
            <button
              type="button"
              className="swift-primary-button"
              onClick={() => navigate("/signup")}
            >
              Create an account <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              className="welcome-signin-button"
              onClick={() => navigate("/signin")}
            >
              I already have an account
            </button>
          </div>
        </section>

        <section className="welcome-visual" aria-label="Swift study materials">
          <img
            src={studyDeskImage}
            alt="Engineering notes, calculator, and technical drawings"
          />
          <div className="welcome-visual-note">
            <p>Course materials</p>
            <strong>100L · 200L · 300L</strong>
          </div>
        </section>
      </main>
    </div>
  );
}
