import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import Icon from "../components/Icons";
import StatusBadge from "../components/StatusBadge";
import {
  EmptyState,
  ErrorBanner,
  Loading,
  PageHeader,
  SectionCard,
  StatCard,
} from "../components/ui";
import { deadlineLabel, errorMessage, formatDate, relativeTime, titleCase } from "../format";

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/recruiter/summary"), api.get("/recruiter/jobs")])
      .then(([summaryData, jobsData]) => {
        if (!active) return;
        setSummary(summaryData);
        setJobs(jobsData);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="container page">
        <Loading label="Loading your hiring desk…" />
      </div>
    );
  }

  const firstName = user.full_name.split(" ")[0];
  const byStatus = summary?.by_status || {};
  const recentJobs = [...jobs]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 4);
  const openJobs = jobs.filter((job) => job.status === "open" && !job.is_expired);
  const pipeline = ["applied", "shortlisted", "interview", "offered", "hired"];

  return (
    <div className="container page">
      <PageHeader
        eyebrow="Recruiter dashboard"
        title={`Good to see you, ${firstName}.`}
        description="Your open roles, your applicants and the next decision that needs you."
        actions={
          <>
            <Link to="/recruiter/company" className="btn btn-secondary">
              Company profile
            </Link>
            <Link to="/recruiter/jobs/new" className="btn btn-primary">
              <Icon name="plus" size={16} /> Post a job
            </Link>
          </>
        }
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      {!summary?.company ? (
        <section className="onboarding-banner">
          <span className="onboarding-icon">
            <Icon name="building" size={24} />
          </span>
          <div>
            <h2>Finish your company profile first</h2>
            <p>
              Candidates need to know who is hiring. Add your company details, then publish your
              first role.
            </p>
          </div>
          <Link to="/recruiter/company" className="btn btn-accent">
            Set up company <Icon name="arrowRight" size={16} />
          </Link>
        </section>
      ) : null}

      <div className="stat-grid">
        <StatCard
          label="Total jobs"
          value={summary?.jobs_total ?? 0}
          helper="including drafts and closed roles"
          icon="briefcase"
          tone="teal"
        />
        <StatCard
          label="Open roles"
          value={summary?.open_jobs ?? 0}
          helper="live and accepting applications"
          icon="sparkles"
          tone="green"
        />
        <StatCard
          label="Applicants"
          value={summary?.total_applicants ?? 0}
          helper="across every posting"
          icon="users"
          tone="blue"
        />
        <StatCard
          label="Interviews"
          value={byStatus.interview || 0}
          helper="conversations in progress"
          icon="calendar"
          tone="amber"
        />
      </div>

      <div className="dashboard-grid">
        <SectionCard
          title="Your roles"
          subtitle="The latest activity across your job posts."
          action={
            <Link to="/recruiter/jobs" className="link-arrow">
              Manage all jobs <Icon name="arrowRight" size={15} />
            </Link>
          }
        >
          {recentJobs.length ? (
            <div className="recruiter-job-list">
              {recentJobs.map((job) => (
                <div className="recruiter-job-row" key={job.id}>
                  <div className="recruiter-job-main">
                    <div className="recruiter-job-title">
                      <Link to={`/recruiter/jobs/${job.id}/applicants`}>{job.title}</Link>
                      <StatusBadge status={job.status} />
                    </div>
                    <span className="muted small">
                      {job.location} · {titleCase(job.employment_type)} · {deadlineLabel(job.deadline)}
                    </span>
                  </div>
                  <div className="recruiter-job-stat">
                    <strong>{job.application_count}</strong>
                    <span>applicants</span>
                  </div>
                  <div className="row-actions">
                    <Link
                      to={`/recruiter/jobs/${job.id}/applicants`}
                      className="btn btn-secondary btn-small"
                    >
                      Review
                    </Link>
                    <Link
                      to={`/recruiter/jobs/${job.id}/edit`}
                      className="icon-button"
                      aria-label={`Edit ${job.title}`}
                    >
                      <Icon name="edit" size={16} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="briefcase"
              title="No jobs posted yet"
              description="Set up your company profile and publish your first role in a few minutes."
              action={
                <Link to="/recruiter/jobs/new" className="btn btn-primary btn-small">
                  Post your first job
                </Link>
              }
            />
          )}
        </SectionCard>

        <div className="dash-side">
          <SectionCard title="Pipeline" subtitle="Every applicant matters.">
            <div className="pipeline-list">
              {pipeline.map((status) => (
                <div className="pipeline-row" key={status}>
                  <span className={`pipeline-dot status-${status}`} />
                  <span>{titleCase(status)}</span>
                  <strong>{byStatus[status] || 0}</strong>
                </div>
              ))}
            </div>
            <div className="pipeline-footer">
              <span>Rejected</span>
              <strong>{byStatus.rejected || 0}</strong>
              <span>Withdrawn</span>
              <strong>{byStatus.withdrawn || 0}</strong>
            </div>
          </SectionCard>

          {summary?.company ? (
            <section className="company-mini">
              <span className="company-mark company-mark-md">
                {summary.company.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{summary.company.name}</strong>
                <span>
                  {summary.company.industry || "Company profile"} ·{" "}
                  {summary.company.jobs_count || 0} jobs
                </span>
              </div>
              <Link to="/recruiter/company" className="link-arrow">
                Edit <Icon name="arrowRight" size={14} />
              </Link>
            </section>
          ) : null}
        </div>
      </div>

      {openJobs.length ? (
        <SectionCard
          title="Roles closing soon"
          subtitle="These live roles have the nearest application deadlines."
          className="next-move-card"
        >
          <div className="next-move-grid">
            {[...openJobs]
              .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
              .slice(0, 3)
              .map((job) => (
                <Link
                  key={job.id}
                  to={`/recruiter/jobs/${job.id}/applicants`}
                  className="next-action"
                >
                  <span className="next-icon">
                    <Icon name="clock" size={20} />
                  </span>
                  <div>
                    <strong>{job.title}</strong>
                    <p>
                      {formatDate(job.deadline)} · {job.application_count} applicant
                      {job.application_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Icon name="arrowRight" size={18} />
                </Link>
              ))}
          </div>
        </SectionCard>
      ) : null}

      {jobs.length ? (
        <p className="dashboard-footnote">
          Latest job update {relativeTime(recentJobs[0]?.updated_at)}. Keep descriptions clear and
          deadlines realistic to attract the right people.
        </p>
      ) : null}
    </div>
  );
}
