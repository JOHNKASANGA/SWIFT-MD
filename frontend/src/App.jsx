import { BrowserRouter, Routes, Route } from "react-router-dom";
import WelcomePage from "./pages/WelcomePage";
import SignUpPage from "./pages/SignUpPage";
import SignInPage from "./pages/SignInPage";
import HomePage from "./pages/HomePage"
import LevelPage from "./pages/LevelPage"
import CoursePage from "./pages/CoursePage"
import TestPage from "./pages/TestPage"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/level/:level" element={<LevelPage />} />
        <Route path="/course/:id" element={<CoursePage />} />
        <Route path="/test/:materialId" element={<TestPage />} />
      </Routes>
    </BrowserRouter>
  );
}
