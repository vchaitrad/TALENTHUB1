import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import Icon from "../components/Icons";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { ErrorBanner, Loading } from "../components/ui";
import { useToast } from "../components/Toast";
import {
  deadlineLabel,
  errorMessage,
  formatDate,
  formatSalary,
  initials,
  titleCase,
} from "../format";

export default function JobDetail() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [myApplication, setMyApplication] = useState(null);

  const [applyOpen, setApplyOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [applyError, setApplyError] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    api
      .get(`/jobs/${jobId}`)
      .then((data) => {
        if (active) setJob(data);
      })
      .catch((err) => {
        if (active) setLoadError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [jobId]);

  useEffect(() => {
    let active = true;
    if (user?.role !== "candidate") {
      setMyApplication(null);
      return undefined;
    }
    api
      .get("/candidate/applications")
      .then((applications) => {
        if (active) {
          setMyApplication(applications.find((item) => item.job.id === Number(jobId)) || null);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [jobId, user?.id, user?.role]);

  const submitApplication = async (event) => {
    event.preventDefault();
    setApplying(true);
    setApplyError("");
    try {
      const application = await api.post(`/jobs/${jobId}/applications`, {
        cover_letter: coverLetter.trim() || null,
      });
      setMyApplication(application);
      setApplyOpen(false);
      setCoverLetter("");
      showToast("Application sent. You can follow its progress in My Applications.", "success");
    } catch (err) {
      setApplyError(errorMessage(err));
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="container page">
        <Loading label="Opening this role…" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container page">
        <div className="empty-state">
          <h2>This role is not available</h2>
          <p>{loadError || "It may have been closed or removed."}</p>
          <Link to="/jobs" className="btn btn-primary">
            Browse open jobs
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = user?.role === "recruiter" && job.recruiter?.id === user.id;
  const canApply = user?.role === "candidate" && job.is_accepting_applications && !myApplication;
  const loginNext = encodeURIComponent(`/jobs/${job.id}`);

  return (
    <div className="container page job-detail-page">
      <Link to="/jobs" className="back-link">
        <Icon name="arrowLeft" size={16} /> All jobs
      </Link>

      <header className="job-detail-head">
        <div className="job-detail-title-wrap">
          <span className="company-mark company-mark-lg">{initials(job.company?.name)}</span>
          <div>
            <div className="job-detail-kicker">
              <span>{job.company?.name}</span>
              <span className="kicker-dot" />
              <span>{job.company?.industry || "Hiring team"}</span>
              {job.is_accepting_applications ? (
                <span className="live-pill">
                  <span className="pulse-dot" /> Actively hiring
                </span>
              ) : (
                <StatusBadge status={job.status} />
              )}
            </div>
            <h1>{job.title}</h1>
            <div className="job-meta job-meta-lg">
              <span>
                <Icon name="pin" size={16} /> {job.location}
              </span>
              <span>
                <Icon name="briefcase" size={16} /> {titleCase(job.employment_type)}
              </span>
              <span>
                <Icon name="chart" size={16} /> {job.experience_level}
              </span>
              <span>
                <Icon name="clock" size={16} /> {deadlineLabel(job.deadline)}
              </span>
            </div>
          </div>
        </div>
        <div className="job-detail-actions">
          {myApplication ? (
            <div className="applied-note">
              <span>You applied for this role</span>
              <StatusBadge status={myApplication.status} />
              <Link to="/candidate/applications" className="link-arrow">
                Track application <Icon name="arrowRight" size={15} />
              </Link>
            </div>
          ) : canApply ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setApplyOpen(true)}>
              Apply for this role <Icon name="arrowRight" size={18} />
            </button>
          ) : user?.role === "candidate" ? (
            <button type="button" className="btn btn-primary btn-lg" disabled>
              {job.is_accepting_applications ? "Application unavailable" : "No longer accepting applications"}
            </button>
          ) : user ? (
            <Link
              to={isOwner ? `/recruiter/jobs/${job.id}/applicants` : user.role === "admin" ? "/admin/jobs" : "/candidate"}
              className="btn btn-secondary"
            >
              {isOwner ? "View applicants" : "Go to dashboard"}
            </Link>
          ) : (
            <Link to={`/login?next=${loginNext}`} className="btn btn-primary btn-lg">
              Log in to apply <Icon name="arrowRight" size={18} />
            </Link>
          )}
        </div>
      </header>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel detail-panel">
            <h2>About the role</h2>
            <p className="long-text">{job.description}</p>

            <h3>What they are looking for</h3>
            <div className="tag-row tag-row-lg">
              {job.skills_required?.map((skill) => (
                <span className="tag tag-large" key={skill}>
                  {skill}
                </span>
              ))}
            </div>

            <h3>How this hiring process works</h3>
            <p className="long-text">
              Applications close on {formatDate(job.deadline)}. The hiring team reviews every
              profile that arrives. If your experience matches, your application moves from
              Applied to Shortlisted, then to Interview and Offer. You can follow each change
              from your TalentHub dashboard.
            </p>
          </section>

          <section className="panel company-panel">
            <div className="company-panel-head">
              <span className="company-mark company-mark-lg">{initials(job.company?.name)}</span>
              <div>
                <h2>{job.company?.name}</h2>
                <p>
                  {job.company?.industry || "Hiring on TalentHub"}
                  {job.company?.location ? ` · ${job.company.location}` : ""}
                </p>
              </div>
            </div>
            <p className="muted">
              This role is managed by {job.recruiter?.full_name} on TalentHub. Questions about the
              role can be discussed during the interview process.
            </p>
          </section>
        </div>

        <aside className="detail-side">
          <section className="apply-card">
            <div className="apply-card-top">
              <span>Compensation</span>
              <strong>{formatSalary(job.salary_min, job.salary_max)}</strong>
              <small>per year</small>
            </div>
            <dl className="fact-list">
              <div>
                <dt>Deadline</dt>
                <dd>{formatDate(job.deadline)}</dd>
              </div>
              <div>
                <dt>Openings</dt>
                <dd>{job.openings}</dd>
              </div>
              <div>
                <dt>Work type</dt>
                <dd>{titleCase(job.employment_type)}</dd>
              </div>
              <div>
                <dt>Applicants</dt>
                <dd>{job.application_count}</dd>
              </div>
              <div>
                <dt>Posted</dt>
                <dd>{formatDate(job.created_at)}</dd>
              </div>
            </dl>

            {canApply ? (
              <button type="button" className="btn btn-primary btn-full" onClick={() => setApplyOpen(true)}>
                Apply now
              </button>
            ) : myApplication ? (
              <Link to="/candidate/applications" className="btn btn-secondary btn-full">
                View my application
              </Link>
            ) : !user ? (
              <Link to={`/login?next=${loginNext}`} className="btn btn-primary btn-full">
                Log in to apply
              </Link>
            ) : (
              <button type="button" className="btn btn-secondary btn-full" disabled>
                Applications closed
              </button>
            )}

            <p className="apply-card-note">
              <Icon name="shield" size={14} />
              Your profile and resume are only shared with this job&apos;s recruiter.
            </p>
          </section>

          {user?.role === "candidate" ? (
            <section className="side-tip">
              <span className="side-tip-icon">
                <Icon name="file" size={18} />
              </span>
              <div>
                <strong>Make your profile count</strong>
                <p>
                  A complete profile with a resume helps recruiters understand your work before
                  the first call.
                </p>
                <Link to="/candidate/profile" className="link-arrow">
                  Update profile <Icon name="arrowRight" size={14} />
                </Link>
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      <Modal
        open={applyOpen}
        title={`Apply to ${job.title}`}
        subtitle={`${job.company?.name} · ${job.location}`}
        onClose={() => setApplyOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setApplyOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="apply-form"
              className="btn btn-primary"
              disabled={applying}
            >
              {applying ? "Sending application…" : "Send application"}
            </button>
          </>
        }
      >
        <ErrorBanner message={applyError} onClose={() => setApplyError("")} />
        <form id="apply-form" className="form-stack" onSubmit={submitApplication}>
          <div className="apply-context">
            <div>
              <span className="muted">Applying as</span>
              <strong>{user?.full_name}</strong>
            </div>
            <div>
              <span className="muted">Deadline</span>
              <strong>{formatDate(job.deadline)}</strong>
            </div>
          </div>
          <label className="field">
            <span className="field-label">Cover note (optional)</span>
            <textarea
              rows={6}
              maxLength={5000}
              value={coverLetter}
              onChange={(event) => setCoverLetter(event.target.value)}
              placeholder="Tell the hiring team why this role is a good fit. A few specific sentences go a long way."
            />
            <span className="field-hint">{coverLetter.length}/5000 characters</span>
          </label>
          <p className="muted small">
            Your candidate profile and resume (if uploaded) will be shared with this recruiter.
            Each candidate can apply once per job.
          </p>
        </form>
      </Modal>
    </div>
  );
}
