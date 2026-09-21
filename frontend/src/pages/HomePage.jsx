import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AppShell from "../components/AppShell";
import StudyDeck from "../components/StudyDeck";

const quickActions = [
  {
    title: "Find a course",
    detail: "Browse your level and open course materials in one place.",
    action: "Open library",
    to: "/level/100",
  },
  {
    title: "Practice properly",
    detail: "Use curated MCQ and fill-in-the-blank banks where available.",
    action: "Choose a course",
    to: "/level/100",
  },
  {
    title: "Calculate your CGPA",
    detail: "Build from your first semester or continue from your current record.",
    action: "Open calculator",
    to: "/cgpa",
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState("");
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    async function loadGreeting(currentUser) {
      const username =
        currentUser.user_metadata?.full_name || currentUser.email.split("@")[0];

      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/generate-greeting`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username }),
          }
        );

        if (!response.ok) throw new Error("Greeting request failed");

        const data = await response.json();
        setGreeting(data.greeting.replace(/^#+\s*/, ""));
      } catch {
        setGreeting(`Welcome back, ${username}. Pick up where you left off.`);
      } finally {
        setLoading(false);
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "INITIAL_SESSION") {
          if (!session) {
            navigate("/signin");
            return;
          }

          if (!initialized.current) {
            initialized.current = true;
            loadGreeting(session.user);
          }
        }

        if (event === "SIGNED_OUT") {
          navigate("/signin");
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  if (loading) {
    return (
      <div className="swift-loading-screen">
        <span className="swift-loading-mark">S</span>
        <p>Preparing your study space...</p>
      </div>
    );
  }

  return (
    <AppShell onSignOut={handleSignOut}>
      <div className="swift-home-page">
        <section className="swift-home-intro">
          <p className="swift-eyebrow">Swift for UNILAG Engineering</p>
          <h1>Study with a clearer system.</h1>
          <p className="swift-greeting">{greeting}</p>
        </section>

        <StudyDeck />

        <section className="swift-quick-actions" id="practice">
          <div className="section-heading">
            <div>
              <p className="swift-eyebrow">Start here</p>
              <h2>Made for the work in front of you.</h2>
            </div>
            <p>
              Materials, curated practice, and academic tools without making
              you hunt through folders.
            </p>
          </div>

          <div className="quick-action-grid">
            {quickActions.map((item) => (
              <article key={item.title} className="quick-action">
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <button type="button" onClick={() => navigate(item.to)}>
                  {item.action} <span aria-hidden="true">→</span>
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
