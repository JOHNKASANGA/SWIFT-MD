import { Link } from "react-router-dom";

export default function AuthFrame({
  title,
  description,
  children,
  footer,
  showBack = true,
}) {
  return (
    <div className="auth-page">
      <header className="public-header">
        <Link to="/" className="swift-brand" aria-label="Go to Swift home">
          <span className="swift-brand-mark">S</span>
          <span>Swift</span>
        </Link>

        {showBack && (
          <Link to="/" className="public-header-link">
            Back to home
          </Link>
        )}
      </header>

      <main className="auth-main">
        <section className="auth-intro">
          <p className="swift-eyebrow">Swift for UNILAG Engineering</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </section>

        <section className="auth-card">
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </section>
      </main>
    </div>
  );
}
