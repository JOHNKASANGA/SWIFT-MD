import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import WelcomePage from "./pages/WelcomePage";
import "./interior-polish.css";

const SignUpPage = lazy(() => import("./pages/SignUpPage"));
const SignInPage = lazy(() => import("./pages/SignInPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const LevelPage = lazy(() => import("./pages/LevelPage"));
const CoursePage = lazy(() => import("./pages/CoursePage"));
const TestPage = lazy(() => import("./pages/TestPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const ViewerPage = lazy(() => import("./pages/ViewerPage"));
const CGPACalculatorPage = lazy(() => import("./pages/CGPACalculatorPage"));
const PracticePage = lazy(() => import("./pages/PracticePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const MaterialStudyCheckPage = lazy(() => import("./pages/MaterialStudyCheckPage"));
const PublicPolicyPage = lazy(() => import("./pages/PublicPolicyPage"));

function RouteFallback() {
  return (
    <div className="swift-loading-screen" role="status">
      <span className="swift-loading-mark">S</span>
      <p>Opening Swift...</p>
    </div>
  );
}

export default function App() {
  useEffect(() => {
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
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/level/:level" element={<LevelPage />} />
          <Route path="/course/:id" element={<CoursePage />} />
          <Route path="/test/:courseCode" element={<TestPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/view/:materialId" element={<ViewerPage />} />
          <Route path="/study-check/:materialId" element={<MaterialStudyCheckPage />} />
          <Route path="/cgpa" element={<CGPACalculatorPage />} />
          <Route path="/privacy" element={<PublicPolicyPage page="privacy" />} />
          <Route path="/terms" element={<PublicPolicyPage page="terms" />} />
          <Route path="/accessibility" element={<PublicPolicyPage page="accessibility" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
