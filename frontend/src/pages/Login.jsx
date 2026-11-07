import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { dashboardPath, useAuth } from "../auth/AuthContext";
import Icon from "../components/Icons";
import { ErrorBanner } from "../components/ui";
import { errorMessage } from "../format";

const DEMOS = [
  {
    role: "Candidate",
    email: "candidate@example.com",
    password: "Candidate123!",
    note: "Aarav, frontend engineer",
  },
  {
    role: "Recruiter",
    email: "recruiter@technova.com",
    password: "Recruiter123!",
    note: "Sofia at TechNova Labs",
  },
  {
    role: "Admin",
    email: "admin@talenthub.dev",
    password: "Admin123!",
    note: "Platform operations",
  },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={next || dashboardPath(user.role)} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const loggedIn = await login(email.trim(), password);
      navigate(next || dashboardPath(loggedIn.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (demo) => {
    setEmail(demo.email);
    setPassword(demo.password);
    setError("");
  };

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link to="/" className="auth-brand">
          <span className="brand-mark brand-mark-light">T</span>
          TalentHub
        </Link>
        <div className="auth-aside-copy">
          <span className="eyebrow eyebrow-light">Welcome back</span>
          <h1>Pick up where you left off.</h1>
          <p>
            Your applications, your candidates, your platform — everything is exactly where
            you left it.
          </p>
        </div>
        <div className="auth-quote">
          <p>
            “The clearest hiring pipeline I have used. I always know what happens next, and
            candidates do too.”
          </p>
          <span>Sofia Ramirez · TechNova Labs</span>
        </div>
        <div className="auth-aside-footer">TalentHub · People-first hiring</div>
      </aside>

      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="auth-heading">
            <h2>Log in to TalentHub</h2>
            <p>
              New here? <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</Link>
            </p>
          </div>

          <ErrorBanner message={error} onClose={() => setError("")} />

          <form className="form-stack" onSubmit={submit}>
            <label className="field">
              <span className="field-label">Email address</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Password</span>
              <div className="password-input">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? "Logging in…" : "Log in"}
              {!submitting ? <Icon name="arrowRight" size={17} /> : null}
            </button>
          </form>

          <div className="demo-block">
            <div className="demo-head">
              <span>Demo accounts</span>
              <span className="demo-rule" />
            </div>
            <div className="demo-list">
              {DEMOS.map((demo) => (
                <button
                  key={demo.role}
                  type="button"
                  className="demo-account"
                  onClick={() => fillDemo(demo)}
                >
                  <span className={`demo-avatar demo-${demo.role.toLowerCase()}`}>
                    {demo.role.slice(0, 1)}
                  </span>
                  <span className="demo-copy">
                    <strong>{demo.role}</strong>
                    <small>{demo.note}</small>
                  </span>
                  <span className="demo-use">Use</span>
                </button>
              ))}
            </div>
            <p className="demo-hint">Click a demo account to fill the form, then log in.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
