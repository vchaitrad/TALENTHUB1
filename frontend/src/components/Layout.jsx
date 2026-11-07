import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { dashboardPath, useAuth } from "../auth/AuthContext";
import { initials, roleLabel } from "../format";
import Icon from "./Icons";

const NAV_BY_ROLE = {
  candidate: [
    { to: "/candidate", label: "Overview", end: true },
    { to: "/jobs", label: "Browse jobs" },
    { to: "/candidate/applications", label: "My applications" },
    { to: "/candidate/profile", label: "Profile" },
    { to: "/account", label: "Account" },
  ],
  recruiter: [
    { to: "/recruiter", label: "Overview", end: true },
    { to: "/recruiter/jobs", label: "My jobs" },
    { to: "/recruiter/company", label: "Company" },
    { to: "/account", label: "Account" },
  ],
  admin: [
    { to: "/admin", label: "Overview", end: true },
    { to: "/admin/users", label: "Users" },
    { to: "/admin/jobs", label: "Jobs" },
    { to: "/admin/applications", label: "Applications" },
    { to: "/account", label: "Account" },
  ],
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const links = user ? NAV_BY_ROLE[user.role] || [] : [{ to: "/jobs", label: "Browse jobs" }];
  const home = user ? dashboardPath(user.role) : "/";

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link to={home} className="brand" aria-label="TalentHub home">
            <span className="brand-mark">T</span>
            <span className="brand-word">TalentHub</span>
          </Link>

          <nav className={`main-nav ${mobileOpen ? "is-open" : ""}`} aria-label="Main navigation">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              >
                {link.label}
              </NavLink>
            ))}
            {!user ? (
              <div className="mobile-auth">
                <Link to="/login" className="btn btn-secondary btn-small">
                  Log in
                </Link>
                <Link to="/register" className="btn btn-primary btn-small">
                  Get started
                </Link>
              </div>
            ) : (
              <button type="button" className="mobile-logout" onClick={logout}>
                <Icon name="logout" size={16} />
                Sign out
              </button>
            )}
          </nav>

          <div className="header-actions">
            {user ? (
              <>
                <div className="user-chip">
                  <span className="avatar avatar-sm">{initials(user.full_name)}</span>
                  <span className="user-chip-text">
                    <strong>{user.full_name}</strong>
                    <span>{roleLabel(user.role)}</span>
                  </span>
                </div>
                <button
                  type="button"
                  className="icon-button logout-button"
                  onClick={logout}
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <Icon name="logout" size={18} />
                </button>
              </>
            ) : (
              <div className="auth-actions">
                <Link to="/login" className="btn btn-ghost">
                  Log in
                </Link>
                <Link to="/register" className="btn btn-primary">
                  Get started
                </Link>
              </div>
            )}
            <button
              type="button"
              className="mobile-toggle"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              <Icon name={mobileOpen ? "close" : "menu"} size={22} />
            </button>
          </div>
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="brand-mark brand-mark-small">T</span>
            <div>
              <strong>TalentHub</strong>
              <p>Where good work finds good people.</p>
            </div>
          </div>
          <div className="footer-links">
            <Link to="/jobs">Browse jobs</Link>
            <Link to="/login">Log in</Link>
            <Link to="/register">Create an account</Link>
            <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">
              API docs
            </a>
          </div>
          <p className="footer-copy">© {new Date().getFullYear()} TalentHub. Built for better hiring.</p>
        </div>
      </footer>
    </div>
  );
}
