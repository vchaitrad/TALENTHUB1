import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
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
  errorMessage,
  formatDate,
  formatDateTime,
  relativeTime,
  titleCase,
} from "../format";
import { useMeta } from "../useMeta";

const PIPE_ORDER = [
  "applied",
  "shortlisted",
  "interview",
  "offered",
  "hired",
  "rejected",
  "withdrawn",
];

export default function CandidateApplications() {
  const meta = useMeta();
  const { showToast } = useToast();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [withdrawNote, setWithdrawNote] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    api
      .get("/candidate/applications")
      .then(setApplications)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const withdrawable = useMemo(
    () => new Set(meta.withdrawable_application_statuses || []),
    [meta],
  );

  const counts = useMemo(() => {
    const result = { all: applications.length };
    PIPE_ORDER.forEach((status) => {
      result[status] = applications.filter((item) => item.status === status).length;
    });
    return result;
  }, [applications]);

  const visible = useMemo(() => {
    if (filter === "all") return applications;
    if (filter === "active") {
      return applications.filter((item) =>
        ["applied", "shortlisted", "interview", "offered"].includes(item.status),
      );
    }
    return applications.filter((item) => item.status === filter);
  }, [applications, filter]);

  const openWithdraw = (application) => {
    setWithdrawTarget(application);
    setWithdrawNote("");
  };

  const submitWithdraw = async (event) => {
    event.preventDefault();
    if (!withdrawTarget) return;
    setWithdrawing(true);
    setError("");
    try {
      const updated = await api.post(`/applications/${withdrawTarget.id}/withdraw`, {
        note: withdrawNote.trim() || null,
      });
      setApplications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setWithdrawTarget(null);
      showToast("Application withdrawn. The hiring team has been updated.", "success");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWithdrawing(false);
    }
  };

  const tabs = [
    { value: "all", label: "All", count: counts.all },
    { value: "active", label: "Active", count: (counts.applied || 0) + (counts.shortlisted || 0) + (counts.interview || 0) + (counts.offered || 0) },
    { value: "interview", label: "Interview", count: counts.interview || 0 },
    { value: "hired", label: "Hired", count: counts.hired || 0 },
    { value: "rejected", label: "Rejected", count: counts.rejected || 0 },
    { value: "withdrawn", label: "Withdrawn", count: counts.withdrawn || 0 },
  ];

  return (
    <div className="container page">
      <PageHeader
        eyebrow="My applications"
        title="Every application, in the open."
        description="Follow each role from the moment you apply to the final decision. No guessing, no black holes."
        actions={
          <Link to="/jobs" className="btn btn-primary">
            Find more roles <Icon name="arrowRight" size={16} />
          </Link>
        }
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      <div className="filter-tabs" role="tablist" aria-label="Filter applications">
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

      {loading ? (
        <Loading label="Loading your applications…" />
      ) : visible.length ? (
        <div className="application-stack">
          {visible.map((application) => {
            const isOpen = expanded === application.id;
            const canWithdraw = withdrawable.has(application.status);
            return (
              <article className={`application-card status-border-${application.status}`} key={application.id}>
                <div className="application-card-main">
                  <span className="company-mark company-mark-md">
                    {application.job.company_name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="application-card-copy">
                    <div className="application-card-title">
                      <Link to={`/jobs/${application.job.id}`}>{application.job.title}</Link>
                      <StatusBadge status={application.status} />
                    </div>
                    <p>
                      {application.job.company_name} · {application.job.location} ·{" "}
                      {titleCase(application.job.employment_type)}
                    </p>
                    <div className="application-card-meta">
                      <span>
                        <Icon name="calendar" size={14} /> Applied {formatDate(application.created_at)}
                      </span>
                      <span>
                        <Icon name="clock" size={14} /> Updated {relativeTime(application.updated_at)}
                      </span>
                      <span>
                        <Icon name="mail" size={14} /> {application.candidate.email}
                      </span>
                    </div>
                  </div>
                  <div className="application-card-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      onClick={() => setExpanded(isOpen ? null : application.id)}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? "Hide details" : "View details"}
                      <Icon name={isOpen ? "chevronDown" : "arrowRight"} size={15} />
                    </button>
                    {canWithdraw ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-small danger-text"
                        onClick={() => openWithdraw(application)}
                      >
                        Withdraw
                      </button>
                    ) : null}
                  </div>
                </div>

                {isOpen ? (
                  <div className="application-expanded">
                    <div className="application-expanded-grid">
                      <div>
                        <h3>Cover note</h3>
                        {application.cover_letter ? (
                          <p className="long-text small-text">{application.cover_letter}</p>
                        ) : (
                          <p className="muted">No cover note was included with this application.</p>
                        )}
                        <div className="application-facts">
                          <div>
                            <span>Deadline</span>
                            <strong>{formatDate(application.job.deadline)}</strong>
                          </div>
                          <div>
                            <span>Salary</span>
                            <strong>
                              {application.job.salary_min || application.job.salary_max
                                ? `$${Number(application.job.salary_min || 0).toLocaleString()} – $${Number(application.job.salary_max || 0).toLocaleString()}`
                                : "Not listed"}
                            </strong>
                          </div>
                          <div>
                            <span>Job status</span>
                            <strong>{titleCase(application.job.status)}</strong>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h3>Timeline</h3>
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
          icon="briefcase"
          title={applications.length ? "Nothing in this stage" : "No applications yet"}
          description={
            applications.length
              ? "Try another filter to see the rest of your pipeline."
              : "Browse open roles and send your first application. Every step will show up here."
          }
          action={
            <Link to="/jobs" className="btn btn-primary btn-small">
              Browse open roles
            </Link>
          }
        />
      )}

      {applications.length ? (
        <SectionCard className="application-help">
          <div className="help-row">
            <span className="side-tip-icon">
              <Icon name="shield" size={18} />
            </span>
            <div>
              <strong>How status updates work</strong>
              <p>
                Recruiters move applications from Applied to Shortlisted, Interview, Offered and
                Hired. You can withdraw while an application is still Applied or Shortlisted.
              </p>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <Modal
        open={Boolean(withdrawTarget)}
        title="Withdraw this application?"
        subtitle={
          withdrawTarget
            ? `${withdrawTarget.job.title} · ${withdrawTarget.job.company_name}`
            : ""
        }
        onClose={() => setWithdrawTarget(null)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setWithdrawTarget(null)}
            >
              Keep application
            </button>
            <button
              type="submit"
              form="withdraw-form"
              className="btn btn-danger"
              disabled={withdrawing}
            >
              {withdrawing ? "Withdrawing…" : "Withdraw application"}
            </button>
          </>
        }
      >
        <form id="withdraw-form" className="form-stack" onSubmit={submitWithdraw}>
          <p className="muted">
            Withdrawing is final. You cannot re-apply to the same job later, and the recruiter
            will see this application as withdrawn.
          </p>
          <label className="field">
            <span className="field-label">Note to the hiring team (optional)</span>
            <textarea
              rows={4}
              maxLength={2000}
              value={withdrawNote}
              onChange={(event) => setWithdrawNote(event.target.value)}
              placeholder="Let them know why you are stepping back."
            />
          </label>
        </form>
      </Modal>
    </div>
  );
}
