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
import { errorMessage, formatDate, relativeTime, titleCase } from "../format";

export default function CandidateDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/candidate/summary"), api.get("/candidate/applications")])
      .then(([summaryData, applicationData]) => {
        if (!active) return;
        setSummary(summaryData);
        setApplications(applicationData);
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
        <Loading label="Loading your dashboard…" />
      </div>
    );
  }

  const firstName = user.full_name.split(" ")[0];
  const recent = applications.slice(0, 4);
  const byStatus = summary?.by_status || {};
  const pipeline = ["applied", "shortlisted", "interview", "offered", "hired"];

  return (
    <div className="container page">
      <PageHeader
        eyebrow="Candidate dashboard"
        title={`Hello, ${firstName}.`}
        description="Here is what is moving, what needs attention, and where to look next."
        actions={
          <>
            <Link to="/candidate/profile" className="btn btn-secondary">
              Edit profile
            </Link>
            <Link to="/jobs" className="btn btn-primary">
              Browse jobs <Icon name="arrowRight" size={16} />
            </Link>
          </>
        }
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      <div className="stat-grid">
        <StatCard
          label="Applications"
          value={summary?.applications_total ?? 0}
          helper="every role you have applied to"
          icon="briefcase"
          tone="teal"
        />
        <StatCard
          label="Active"
          value={summary?.active_applications ?? 0}
          helper="still in the pipeline"
          icon="clock"
          tone="amber"
        />
        <StatCard
          label="Interviews"
          value={byStatus.interview || 0}
          helper="conversations in progress"
          icon="users"
          tone="blue"
        />
        <StatCard
          label="Offers"
          value={(byStatus.offered || 0) + (byStatus.hired || 0)}
          helper="offers and hires"
          icon="star"
          tone="green"
        />
      </div>

      <div className="dashboard-grid">
        <SectionCard
          title="Recent applications"
          subtitle="The latest movement across your pipeline."
          action={
            <Link to="/candidate/applications" className="link-arrow">
              View all <Icon name="arrowRight" size={15} />
            </Link>
          }
        >
          {recent.length ? (
            <div className="application-list compact">
              {recent.map((application) => (
                <Link
                  key={application.id}
                  to="/candidate/applications"
                  className="application-row"
                >
                  <span className="company-mark">
                    {application.job.company_name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="application-main">
                    <strong>{application.job.title}</strong>
                    <small>
                      {application.job.company_name} · {application.job.location}
                    </small>
                  </span>
                  <StatusBadge status={application.status} />
                  <span className="application-when">{relativeTime(application.updated_at)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="briefcase"
              title="No applications yet"
              description="When you apply to a role, it will show up here with its current status."
              action={
                <Link to="/jobs" className="btn btn-primary btn-small">
                  Find your first role
                </Link>
              }
            />
          )}
        </SectionCard>

        <div className="dash-side">
          <section className="profile-meter">
            <div className="meter-head">
              <div>
                <span className="eyebrow">Profile strength</span>
                <strong>{summary?.profile_completion ?? 0}% complete</strong>
              </div>
              <span className="meter-badge">
                {summary?.profile_completion >= 80 ? "Strong" : summary?.profile_completion >= 50 ? "Growing" : "Getting started"}
              </span>
            </div>
            <div className="progress-track">
              <span
                className="progress-fill"
                style={{ width: `${summary?.profile_completion ?? 0}%` }}
              />
            </div>
            <p>
              {summary?.resume_uploaded
                ? "Your resume is ready for recruiters to review."
                : "Upload a resume so recruiters can see the full picture."}
            </p>
            <div className="meter-actions">
              <Link to="/candidate/profile" className="btn btn-secondary btn-small">
                {summary?.resume_uploaded ? "Polish profile" : "Upload resume"}
              </Link>
              {summary?.resume_uploaded ? (
                <span className="meter-resume">
                  <Icon name="check" size={14} /> Resume on file
                </span>
              ) : null}
            </div>
          </section>

          <SectionCard title="Application pipeline" className="pipeline-card">
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
        </div>
      </div>

      <SectionCard title="Your next best move" className="next-move-card">
        <div className="next-move-grid">
          <Link to="/jobs?sort=deadline" className="next-action">
            <span className="next-icon">
              <Icon name="clock" size={20} />
            </span>
            <div>
              <strong>Roles closing soon</strong>
              <p>See applications with the nearest deadlines before they pass.</p>
            </div>
            <Icon name="arrowRight" size={18} />
          </Link>
          <Link to="/jobs?sort=salary" className="next-action">
            <span className="next-icon next-icon-amber">
              <Icon name="chart" size={20} />
            </span>
            <div>
              <strong>Highest-paying roles</strong>
              <p>Sort open opportunities by the top of their salary range.</p>
            </div>
            <Icon name="arrowRight" size={18} />
          </Link>
          <Link to="/jobs?employment_type=contract" className="next-action">
            <span className="next-icon next-icon-blue">
              <Icon name="briefcase" size={20} />
            </span>
            <div>
              <strong>Flexible work</strong>
              <p>Explore contract and freelance roles that fit around your life.</p>
            </div>
            <Icon name="arrowRight" size={18} />
          </Link>
        </div>
      </SectionCard>

      {applications.length ? (
        <p className="dashboard-footnote">
          Last activity: {formatDate(applications[0].updated_at)} · Keep your profile fresh so
          recruiters see the latest version.
        </p>
      ) : null}
    </div>
  );
}
