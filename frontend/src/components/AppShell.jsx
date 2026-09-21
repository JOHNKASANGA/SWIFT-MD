import { NavLink, useNavigate } from "react-router-dom";

const navigationItems = [
  { label: "Library", to: "/home" },
  { label: "Practice", to: "/practice" },
  { label: "CGPA", to: "/cgpa" },
];

export default function AppShell({ children, onSignOut }) {
  const navigate = useNavigate();

  return (
    <div className="swift-app-shell">
      <header className="swift-header">
        <button
          type="button"
          className="swift-brand"
          onClick={() => navigate("/home")}
          aria-label="Go to Swift home"
        >
          <span className="swift-brand-mark">S</span>
          <span>Swift</span>
        </button>

        <nav className="swift-nav" aria-label="Primary navigation">
          {navigationItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `swift-nav-link ${isActive ? "is-active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="swift-account-button"
          onClick={onSignOut}
        >
          Sign out
        </button>
      </header>

      <main>{children}</main>
    </div>
  );
}
