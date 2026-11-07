import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import JobCard from "../components/JobCard";
import Icon from "../components/Icons";
import { useAuth } from "../auth/AuthContext";
import { dashboardPath } from "../auth/AuthContext";

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get("/jobs?page_size=50&sort=newest")
      .then((data) => {
        if (!active) return;
        setJobs(data.items || []);
        setTotal(data.total || 0);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const featured = jobs.slice(0, 3);
  const companies = new Set(jobs.map((job) => job.company?.name).filter(Boolean)).size;
  const startPath = user ? dashboardPath(user.role) : "/register";

  const onSearch = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (location.trim()) params.set("location", location.trim());
    navigate(`/jobs${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
        <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="hero-eyebrow">
              <span className="pulse-dot" />
              {total > 0 ? `${total} open roles waiting for the right person` : "A calmer way to hire"}
            </span>
            <h1>
              Good work deserves
              <em> good people.</em>
            </h1>
            <p className="hero-lead">
              TalentHub is the hiring home for candidates who care about craft, recruiters
              who care about people, and teams building something worth joining.
            </p>

            <form className="hero-search" onSubmit={onSearch}>
              <div className="hero-search-field">
                <Icon name="search" size={18} />
                <input
                  type="search"
                  placeholder="Role, skill or company"
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  aria-label="Search jobs"
                />
              </div>
              <div className="hero-search-field hero-search-location">
                <Icon name="pin" size={18} />
                <input
                  type="search"
                  placeholder="Location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  aria-label="Filter by location"
                />
              </div>
              <button type="submit" className="btn btn-accent hero-search-button">
                Search jobs
                <Icon name="arrowRight" size={17} />
              </button>
            </form>

            <div className="hero-proof">
              <span>
                <Icon name="check" size={15} /> Free for candidates
              </span>
              <span>
                <Icon name="check" size={15} /> Real people, real roles
              </span>
              <span>
                <Icon name="check" size={15} /> Apply in minutes
              </span>
            </div>
          </div>

          <div className="hero-art" aria-label="Featured roles preview">
            <div className="hero-glow" aria-hidden="true" />
            <div className="hero-portrait">
              <span className="portrait-ring" />
              <div className="portrait-face">
                <span className="portrait-initials">TH</span>
                <div>
                  <strong>TalentHub</strong>
                  <span>People-first hiring</span>
                </div>
              </div>
              <div className="portrait-stat">
                <span>Match quality</span>
                <strong>Human, not keyword soup</strong>
              </div>
            </div>

            {featured.length ? (
              <div className="hero-float-card">
                <div className="float-top">
                  <span className="company-mark">{featured[0].company?.name?.slice(0, 2).toUpperCase() || "TH"}</span>
                  <span className="float-live">
                    <span className="pulse-dot" /> Hiring now
                  </span>
                </div>
                <h3>{featured[0].title}</h3>
                <p>
                  {featured[0].company?.name} · {featured[0].location}
                </p>
                <div className="float-tags">
                  {featured[0].skills_required?.slice(0, 3).map((skill) => (
                    <span className="tag" key={skill}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="hero-mini-card hero-mini-one">
              <span className="mini-icon">
                <Icon name="users" size={17} />
              </span>
              <div>
                <strong>{jobs.reduce((sum, job) => sum + (job.application_count || 0), 0)} applications</strong>
                <span>moving through TalentHub</span>
              </div>
            </div>
            <div className="hero-mini-card hero-mini-two">
              <span className="mini-icon mini-icon-amber">
                <Icon name="building" size={17} />
              </span>
              <div>
                <strong>{companies || "Growing"} hiring teams</strong>
                <span>from startups to studios</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-band">
        <div className="container stats-band-inner">
          <div>
            <strong>{total}</strong>
            <span>open roles</span>
          </div>
          <div>
            <strong>{companies}</strong>
            <span>teams hiring</span>
          </div>
          <div>
            <strong>3</strong>
            <span>role-based dashboards</span>
          </div>
          <div>
            <strong>1</strong>
            <span>calm place to hire</span>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow">Fresh opportunities</span>
            <h2>Roles worth a closer look</h2>
            <p>Hand-picked from teams using TalentHub right now.</p>
          </div>
          <Link to="/jobs" className="link-arrow">
            See all {total} roles <Icon name="arrowRight" size={17} />
          </Link>
        </div>

        {loading ? (
          <div className="job-grid">
            {[1, 2, 3].map((item) => (
              <div className="skeleton-card" key={item} />
            ))}
          </div>
        ) : featured.length ? (
          <div className="job-grid">
            {featured.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No open roles just yet</h3>
            <p>Create a recruiter account and post the first one.</p>
          </div>
        )}
      </section>

      <section className="section section-tinted">
        <div className="container">
          <div className="section-head centered">
            <div>
              <span className="eyebrow">One platform, three points of view</span>
              <h2>Built for every side of the hire</h2>
              <p>Clear workflows for the people doing the work and the people making it possible.</p>
            </div>
          </div>

          <div className="persona-grid">
            <article className="persona-card">
              <span className="persona-icon">
                <Icon name="users" size={22} />
              </span>
              <h3>For candidates</h3>
              <p>Build a profile that feels like you, find roles that fit, and follow every application in one place.</p>
              <ul>
                <li>Search and filter open roles</li>
                <li>Upload a resume once</li>
                <li>Track each step, transparently</li>
              </ul>
              <Link to="/register?role=candidate" className="link-arrow">
                Create a candidate profile <Icon name="arrowRight" size={16} />
              </Link>
            </article>

            <article className="persona-card persona-card-dark">
              <span className="persona-icon">
                <Icon name="briefcase" size={22} />
              </span>
              <h3>For recruiters</h3>
              <p>Publish thoughtful job posts, see who really applied, and move people through a clear hiring pipeline.</p>
              <ul>
                <li>Company profile and job posts</li>
                <li>Applicant profiles and resumes</li>
                <li>Status changes with a full audit trail</li>
              </ul>
              <Link to="/register?role=recruiter" className="link-arrow">
                Start hiring on TalentHub <Icon name="arrowRight" size={16} />
              </Link>
            </article>

            <article className="persona-card">
              <span className="persona-icon persona-icon-amber">
                <Icon name="shield" size={22} />
              </span>
              <h3>For admins</h3>
              <p>Keep the platform healthy with user management, job oversight, and a clear view of what is happening.</p>
              <ul>
                <li>Activate or disable accounts</li>
                <li>Manage every job and application</li>
                <li>Platform-wide statistics</li>
              </ul>
              <Link to="/login" className="link-arrow">
                Open the admin console <Icon name="arrowRight" size={16} />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="how-grid">
          <div className="how-copy">
            <span className="eyebrow">A simpler path</span>
            <h2>From first look to first day</h2>
            <p>
              No black holes, no mystery statuses. TalentHub keeps the important moments visible
              to the people they affect.
            </p>
            <Link to={startPath} className="btn btn-primary">
              {user ? "Back to my dashboard" : "Create your free account"}
              <Icon name="arrowRight" size={17} />
            </Link>
          </div>
          <ol className="steps">
            <li>
              <span className="step-number">01</span>
              <div>
                <h3>Make a profile with substance</h3>
                <p>Skills, experience, education and your resume — all in one place.</p>
              </div>
            </li>
            <li>
              <span className="step-number">02</span>
              <div>
                <h3>Find the role that fits</h3>
                <p>Search by title, skill, location, salary and work type.</p>
              </div>
            </li>
            <li>
              <span className="step-number">03</span>
              <div>
                <h3>Know where you stand</h3>
                <p>Every application has a clear status and a timeline you can follow.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="container">
        <div className="cta-band">
          <div>
            <span className="eyebrow eyebrow-light">Your next chapter</span>
            <h2>Ready to find your people?</h2>
            <p>Join as a candidate or bring your whole team as a recruiter.</p>
          </div>
          <div className="cta-actions">
            <Link to="/register" className="btn btn-accent">
              Get started free
            </Link>
            <Link to="/jobs" className="btn btn-outline-light">
              Browse jobs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
