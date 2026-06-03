import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

function keepAlive() {
  fetch(`${import.meta.env.VITE_BACKEND_URL}/health`)
    .catch(() => {}) // fail silently
}

keepAlive()
setInterval(keepAlive, 10 * 60 * 1000)

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
