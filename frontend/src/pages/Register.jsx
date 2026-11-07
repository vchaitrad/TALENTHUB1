import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Icon from "../components/Icons";
import { ErrorBanner, Field } from "../components/ui";
import { errorMessage } from "../format";
import { useMeta } from "../useMeta";

const ROLE_CARDS = [
  {
    value: "candidate",
    title: "I'm looking for work",
    description: "Build a profile, browse roles and track applications.",
    icon: "users",
  },
  {
    value: "recruiter",
    title: "I'm hiring",
    description: "Create a company profile, post jobs and review applicants.",
    icon: "briefcase",
  },
  {
    value: "admin",
    title: "I manage the platform",
    description: "Moderate users, jobs and applications. Invite code required.",
    icon: "shield",
  },
];

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole = ["candidate", "recruiter", "admin"].includes(searchParams.get("role"))
    ? searchParams.get("role")
    : "candidate";
  const next = searchParams.get("next");
  const meta = useMeta();
  const minPassword = meta.limits?.password_min_length || 8;

  const [role, setRole] = useState(initialRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={next || (user.role === "admin" ? "/admin" : user.role === "recruiter" ? "/recruiter" : "/candidate")} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (password.length < minPassword) {
      setError(`Password must be at least ${minPassword} characters long.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await register({
        email: email.trim(),
        full_name: fullName.trim(),
        password,
        role,
        ...(role === "admin" ? { admin_invite_code: inviteCode } : {}),
      });
      const destination =
        next ||
        (created.role === "candidate"
          ? "/candidate/profile"
          : created.role === "recruiter"
            ? "/recruiter/company"
            : "/admin");
      navigate(destination, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page register-page">
      <aside className="auth-aside register-aside">
        <Link to="/" className="auth-brand">
          <span className="brand-mark brand-mark-light">T</span>
          TalentHub
        </Link>
        <div className="auth-aside-copy">
          <span className="eyebrow eyebrow-light">Make your move</span>
          <h1>One account. The whole hiring story.</h1>
          <p>
            Whether you are looking for your next role or your next teammate, TalentHub keeps
            the important details in one clear place.
          </p>
        </div>
        <ul className="auth-benefits">
          <li>
            <Icon name="check" size={16} /> A profile that shows your actual work
          </li>
          <li>
            <Icon name="check" size={16} /> Jobs with real deadlines and clear requirements
          </li>
          <li>
            <Icon name="check" size={16} /> Transparent application statuses
          </li>
        </ul>
        <div className="auth-aside-footer">Free for candidates · Built for teams</div>
      </aside>

      <section className="auth-panel">
        <div className="auth-form-wrap auth-form-wide">
          <div className="auth-heading">
            <h2>Create your account</h2>
            <p>
              Already have one? <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Log in</Link>
            </p>
          </div>

          <ErrorBanner message={error} onClose={() => setError("")} />

          <div className="role-picker" role="group" aria-label="Choose account type">
            {ROLE_CARDS.map((card) => (
              <button
                type="button"
                key={card.value}
                className={`role-option ${role === card.value ? "selected" : ""}`}
                onClick={() => setRole(card.value)}
                aria-pressed={role === card.value}
              >
                <span className="role-option-icon">
                  <Icon name={card.icon} size={19} />
                </span>
                <span>
                  <strong>{card.title}</strong>
                  <small>{card.description}</small>
                </span>
                <span className="role-check">{role === card.value ? <Icon name="check" size={13} /> : null}</span>
              </button>
            ))}
          </div>

          <form className="form-stack" onSubmit={submit}>
            <Field label="Full name" required>
              <input
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your full name"
                minLength={2}
                maxLength={120}
                required
              />
            </Field>

            <Field label="Email address" required>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </Field>

            <div className="form-grid-two">
              <Field label="Password" hint={`At least ${minPassword} characters`} required>
                <div className="password-input">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Create a password"
                    minLength={minPassword}
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
              </Field>
              <Field label="Confirm password" required>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat password"
                  minLength={minPassword}
                  required
                />
              </Field>
            </div>

            {role === "admin" ? (
              <Field
                label="Admin invite code"
                hint="Ask the platform owner for the private code. The demo default is documented in README.md."
                required
              >
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                  placeholder="Enter the admin invite code"
                  autoComplete="off"
                  required
                />
              </Field>
            ) : null}

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
              {!submitting ? <Icon name="arrowRight" size={17} /> : null}
            </button>
            <p className="form-terms">
              By creating an account you agree to keep TalentHub a respectful place to hire and
              be hired.
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
