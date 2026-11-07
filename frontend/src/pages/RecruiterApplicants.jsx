import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, downloadResume } from "../api";
import Icon from "../components/Icons";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import {
  EmptyState,
  ErrorBanner,
  Loading,
  PageHeader,
  SectionCard,
} from "../components/ui";
import {
  deadlineLabel,
  errorMessage,
  formatDate,
  formatDateTime,
  relativeTime,
  titleCase,
} from "../format";
import { useMeta } from "../useMeta";

export default function RecruiterApplicants() {
  const { jobId } = useParams();
  const meta = useMeta();
  const { showToast } = useToast();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const [statusTarget, setStatusTarget] = useState(null);
  const [nextStatus, setNextStatus] = useState("");
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get(`/recruiter/jobs/${jobId}`),
      api.get(`/recruiter/jobs/${jobId}/applications`),
    ])
      .then(([jobData, applicationData]) => {
        setJob(jobData);
        setApplications(applicationData);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [jobId]);

  const counts = useMemo(() => {
    const result = { all: applications.length };
    applications.forEach((application) => {
      result[application.status] = (result[application.status] || 0) + 1;
    });
    return result;
  }, [applications]);

  const tabs = useMemo(() => {
    const base = [{ value: "all", label: "All", count: counts.all }];
    (meta.application_statuses || []).forEach((status) => {
      if (counts[status.value]) {
        base.push({ value: status.value, label: status.label, count: counts[status.value] });
      }
    });
    return base;
  }, [counts, meta.application_statuses]);

  const visible = useMemo(() => {
    if (filter === "all") return applications;
    return applications.filter((application) => application.status === filter);
  }, [applications, filter]);

  const openStatusModal = (application) => {
    const allowed = meta.application_status_transitions?.[application.status] || [];
    if (!allowed.length) {
      showToast("This application is in a final stage and cannot be moved.", "error");
      return;
    }
    setStatusTarget(application);
    setNextStatus(allowed[0]);
    setNote("");
  };

  const submitStatus = async (event) => {
    event.preventDefault();
    if (!statusTarget || !nextStatus) return;
    setUpdating(true);
    setError("");
    try {
      const updated = await api.patch(`/recruiter/applications/${statusTarget.id}/status`, {
        status: nextStatus,
        note: note.trim() || null,
      });
      setApplications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setStatusTarget(null);
      showToast(
        `${updated.candidate.full_name} moved to ${titleCase(updated.status)}.`,
        "success",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUpdating(false);
    }
  };

  const handleDownload = async (application) => {
    if (!application.candidate.resume_available) return;
    setDownloading(application.id);
    setError("");
    try {
      await downloadResume(application.candidate.profile_id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="container page">
        <Loading label="Loading applicants…" />
      </div>
    );
  }

  const transitions = statusTarget
    ? meta.application_status_transitions?.[statusTarget.status] || []
    : [];

  return (
    <div className="container page">
      <Link to="/recruiter/jobs" className="back-link">
        <Icon name="arrowLeft" size={16} /> My jobs
      </Link>

      <PageHeader
        eyebrow="Applicants"
        title={job?.title || "Job applicants"}
        description={
          job
            ? `${job.company?.name} · ${job.location} · ${job.application_count} applicant${
                job.application_count === 1 ? "" : "s"
              } · ${deadlineLabel(job.deadline)}`
            : "Review the people who applied to this role."
        }
        actions={
          <>
            {job?.status !== "closed" ? (
              <Link to={`/recruiter/jobs/${jobId}/edit`} className="btn btn-secondary">
                <Icon name="edit" size={16} /> Edit job
              </Link>
            ) : null}
            <Link to={`/jobs/${jobId}`} className="btn btn-primary">
              View public page <Icon name="external" size={16} />
            </Link>
          </>
        }
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      {job ? (
        <div className="job-context">
          <div className="job-context-main">
            <StatusBadge status={job.status} />
            <span className="muted small">
              {job.openings} opening{job.openings === 1 ? "" : "s"} ·{" "}
              {titleCase(job.employment_type)} · {job.experience_level}
            </span>
          </div>
          <div className="job-context-actions">
            {job.skills_required?.slice(0, 4).map((skill) => (
              <span className="tag" key={skill}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="filter-tabs" role="tablist" aria-label="Filter applicants">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={filter === tab.value}
            className={`filter-tab ${filter === tab.value ? "active" : ""}`}
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
            <span>{tab.count}</span>
          </button>
        ))}
      </div>

      {visible.length ? (
        <div className="applicant-stack">
          {visible.map((application) => {
            const candidate = application.candidate;
            const isOpen = expanded === application.id;
            const allowed = meta.application_status_transitions?.[application.status] || [];
            return (
              <article
                className={`applicant-card status-border-${application.status}`}
                key={application.id}
              >
                <div className="applicant-head">
                  <span className="avatar avatar-md">
                    {candidate.full_name?.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="applicant-identity">
                    <div className="applicant-name-row">
                      <h2>{candidate.full_name}</h2>
                      <StatusBadge status={application.status} />
                    </div>
                    <p>{candidate.headline || "Candidate profile"}</p>
                    <div className="applicant-contact">
                      <a href={`mailto:${candidate.email}`}>
                        <Icon name="mail" size={14} /> {candidate.email}
                      </a>
                      {candidate.phone ? (
                        <span>
                          <Icon name="users" size={14} /> {candidate.phone}
                        </span>
                      ) : null}
                      {candidate.location ? (
                        <span>
                          <Icon name="pin" size={14} /> {candidate.location}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="applicant-actions">
                    <span className="muted small">Applied {relativeTime(application.created_at)}</span>
                    {allowed.length ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        onClick={() => openStatusModal(application)}
                      >
                        Move stage <Icon name="arrowRight" size={14} />
                      </button>
                    ) : (
                      <span className="tag">{titleCase(application.status)} is final</span>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      onClick={() => setExpanded(isOpen ? null : application.id)}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? "Hide profile" : "View profile"}
                      <Icon name={isOpen ? "chevronDown" : "arrowRight"} size={14} />
                    </button>
                  </div>
                </div>

                {candidate.skills?.length ? (
                  <div className="tag-row applicant-skills">
                    {candidate.skills.slice(0, isOpen ? 50 : 8).map((skill) => (
                      <span className="tag" key={skill}>
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : null}

                {application.cover_letter ? (
                  <p className={`applicant-cover ${isOpen ? "long-text" : "clamp-3"}`}>
                    {application.cover_letter}
                  </p>
                ) : (
                  <p className="muted small">No cover note was included.</p>
                )}

                <div className="applicant-card-foot">
                  <span className="muted small">
                    Updated {formatDateTime(application.updated_at)}
                  </span>
                  <div className="inline-actions">
                    {candidate.linkedin_url ? (
                      <a
                        href={candidate.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost btn-small"
                      >
                        LinkedIn <Icon name="external" size={13} />
                      </a>
                    ) : null}
                    {candidate.portfolio_url ? (
                      <a
                        href={candidate.portfolio_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost btn-small"
                      >
                        Portfolio <Icon name="external" size={13} />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      disabled={!candidate.resume_available || downloading === application.id}
                      onClick={() => handleDownload(application)}
                    >
                      <Icon name="download" size={14} />
                      {candidate.resume_available
                        ? downloading === application.id
                          ? "Downloading…"
                          : "Resume"
                        : "No resume"}
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="applicant-expanded">
                    <div className="applicant-expanded-grid">
                      <div>
                        <h3>About</h3>
                        <p className="long-text small-text">
                          {candidate.summary || "This candidate has not added a summary yet."}
                        </p>

                        <h3>Experience</h3>
                        {candidate.experience?.length ? (
                          <ul className="mini-timeline">
                            {candidate.experience.map((item, index) => (
                              <li key={`${item.company}-${index}`}>
                                <strong>{item.title}</strong>
                                <span>
                                  {item.company} · {item.start_date || "—"} –{" "}
                                  {item.end_date || "Present"}
                                </span>
                                {item.description ? <p>{item.description}</p> : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted small">No experience added.</p>
                        )}

                        <h3>Education</h3>
                        {candidate.education?.length ? (
                          <ul className="mini-timeline">
                            {candidate.education.map((item, index) => (
                              <li key={`${item.institution}-${index}`}>
                                <strong>
                                  {item.degree}
                                  {item.field_of_study ? ` · ${item.field_of_study}` : ""}
                                </strong>
                                <span>
                                  {item.institution} · {item.start_year || "—"} –{" "}
                                  {item.end_year || "—"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted small">No education added.</p>
                        )}
                      </div>

                      <div>
                        <h3>Application timeline</h3>
                        <ol className="timeline">
                          {application.history.map((entry, index) => (
                            <li key={entry.id || index}>
                              <span className={`timeline-dot status-${entry.to_status}`} />
                              <div>
                                <strong>{titleCase(entry.to_status)}</strong>
                                <span>
                                  {formatDateTime(entry.created_at)}
                                  {entry.changed_by_name ? ` · ${entry.changed_by_name}` : ""}
                                </span>
                                {entry.note ? <p>{entry.note}</p> : null}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="users"
          title={
            applications.length ? "No applicants in this stage" : "No applicants yet"
          }
          description={
            applications.length
              ? "Try another stage filter to see the rest of your pipeline."
              : "When candidates apply, their profiles will appear here with a clear next step."
          }
          action={
            <Link to="/recruiter/jobs" className="btn btn-secondary btn-small">
              Back to my jobs
            </Link>
          }
        />
      )}

      <SectionCard className="application-help">
        <div className="help-row">
          <span className="side-tip-icon">
            <Icon name="shield" size={18} />
          </span>
          <div>
            <strong>Only the posting recruiter can manage these applicants</strong>
            <p>
              Applications move forward only: Applied → Shortlisted → Interview → Offered → Hired.
              Rejection is possible from any active stage. Hired, rejected and withdrawn are final.
            </p>
          </div>
        </div>
      </SectionCard>

      <Modal
        open={Boolean(statusTarget)}
        title={
          statusTarget
            ? `Move ${statusTarget.candidate.full_name} forward`
            : "Move applicant"
        }
        subtitle={
          statusTarget
            ? `${statusTarget.job.title} · currently ${titleCase(statusTarget.status)}`
            : ""
        }
        onClose={() => setStatusTarget(null)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStatusTarget(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="status-form"
              className="btn btn-primary"
              disabled={updating}
            >
              {updating ? "Updating…" : "Update status"}
            </button>
          </>
        }
      >
        <ErrorBanner message={error} onClose={() => setError("")} />
        <form id="status-form" className="form-stack" onSubmit={submitStatus}>
          <label className="field">
            <span className="field-label">Next stage</span>
            <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
              {transitions.map((status) => (
                <option key={status} value={status}>
                  {titleCase(status)}
                </option>
              ))}
            </select>
            <span className="field-hint">
              Only valid next stages are shown. Final stages cannot be changed.
            </span>
          </label>
          <label className="field">
            <span className="field-label">Note for the candidate (optional)</span>
            <textarea
              rows={4}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Share what happens next or why you are moving them forward."
            />
          </label>
        </form>
      </Modal>
    </div>
  );
}
