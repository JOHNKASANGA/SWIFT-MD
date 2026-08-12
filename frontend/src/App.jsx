import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import WelcomePage from "./pages/WelcomePage";
import SignUpPage from "./pages/SignUpPage";
import SignInPage from "./pages/SignInPage";
import HomePage from "./pages/HomePage";
import LevelPage from "./pages/LevelPage";
import CoursePage from "./pages/CoursePage";
import TestPage from "./pages/TestPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ViewerPage from "./pages/ViewerPage";

export default function App() {
  useEffect(() => {
    // Strip any leftover OAuth hash fragment from the URL after Supabase
    // has had a chance to process it. Without this, a stale "#access_token=..."
    // hash gets re-parsed as a fresh (now expired) OAuth callback on every
    // page load, which breaks session persistence.
    if (window.location.hash && window.location.hash.length > 1) {
      const timeout = setTimeout(() => {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/level/:level" element={<LevelPage />} />
        <Route path="/course/:id" element={<CoursePage />} />
        <Route path="/test/:courseCode" element={<TestPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/view/:materialId" element={<ViewerPage />} />
      </Routes>
    </BrowserRouter>
  );
}
