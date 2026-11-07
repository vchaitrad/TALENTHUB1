import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, buildQuery } from "../api";
import Icon from "../components/Icons";
import StatusBadge from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import {
  ConfirmDialog,
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
  salarySuffix,
  formatSalary,
  titleCase,
} from "../format";
import { useMeta } from "../useMeta";

const STATUS_FILTERS = [
  { value: "all", label: "All jobs" },
  { value: "open", label: "Open" },
  { value: "draft", label: "Drafts" },
  { value: "closed", label: "Closed" },
];

function transitionLabel(current, target) {
  if (target === "open") {
    return current === "closed" ? "Reopen" : "Publish";
  }
  if (target === "closed") {
    return current === "draft" ? "Close draft" : "Close";
  }
  return `Mark ${titleCase(target)}`;
}

export default function RecruiterJobs() {
  const meta = useMeta();
  const { showToast } = useToast();
  const [jobs, setJobs] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get(
        `/recruiter/jobs${buildQuery({
          status: status === "all" ? undefined : status,
          q: query || undefined,
        })}`,
      ),
      api.get("/recruiter/company"),
    ])
      .then(([jobList, companyData]) => {
        setJobs(jobList);
        setCompany(companyData);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [status, query]);

  const counts = useMemo(() => {
    const result = { all: jobs.length, open: 0, draft: 0, closed: 0 };
    jobs.forEach((job) => {
      result[job.status] = (result[job.status] || 0) + 1;
    });
    return result;
  }, [jobs]);

  const submitSearch = (event) => {
    event.preventDefault();
    setQuery(searchDraft.trim());
  };

  const changeStatus = async (job, target) => {
    setBusyId(job.id);
    setError("");
    try {
      const updated = await api.patch(`/recruiter/jobs/${job.id}/status`, { status: target });
      setJobs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      showToast(`“${job.title}” is now ${target}.`, "success");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    setError("");
    try {
      await api.delete(`/recruiter/jobs/${deleteTarget.id}`);
      setJobs((current) => current.filter((item) => item.id !== deleteTarget.id));
      showToast(`“${deleteTarget.title}” was deleted.`, "success");
      setDeleteTarget(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container page">
      <PageHeader
        eyebrow="My jobs"
        title="Every role, from draft to hire."
        description="Publish roles, keep deadlines honest and move straight into the applicant pipeline."
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

      {!company ? (
        <section className="onboarding-banner">
          <span className="onboarding-icon">
            <Icon name="building" size={24} />
          </span>
          <div>
            <h2>Create your company profile first</h2>
            <p>A job must belong to a company. Set yours up, then publish your first role.</p>
          </div>
          <Link to="/recruiter/company" className="btn btn-accent">
            Set up company <Icon name="arrowRight" size={16} />
          </Link>
        </section>
      ) : null}

      <SectionCard>
        <div className="toolbar">
          <form className="toolbar-search" onSubmit={submitSearch}>
            <label className="search-input">
              <Icon name="search" size={18} />
              <input
                type="search"
                placeholder="Search your job titles"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
              />
            </label>
            <button type="submit" className="btn btn-secondary btn-small">
              Search
            </button>
          </form>

          <div className="segmented" role="tablist" aria-label="Filter jobs by status">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={status === filter.value}
                className={`seg-btn ${status === filter.value ? "active" : ""}`}
                onClick={() => setStatus(filter.value)}
              >
                {filter.label}
                {filter.value === status ? <span>{counts[filter.value] || 0}</span> : null}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <Loading label="Loading your jobs…" />
        ) : jobs.length ? (
          <div className="recruiter-job-list">
            {jobs.map((job) => {
              const transitions = meta.job_status_transitions?.[job.status] || [];
              return (
                <article className="recruiter-job-row" key={job.id}>
                  <div className="recruiter-job-main">
                    <div className="recruiter-job-title">
                      <Link to={`/recruiter/jobs/${job.id}/applicants`}>{job.title}</Link>
                      <StatusBadge status={job.status} />
                      {job.is_expired ? <span className="tag tag-warn">Deadline passed</span> : null}
                    </div>
                    <span className="muted small">
                      {job.location} · {titleCase(job.employment_type)} ·{" "}
                      {formatSalary(job.salary_min, job.salary_max)} {salarySuffix(job)} ·{" "}
                      {deadlineLabel(job.deadline)}
                    </span>
                    <span className="muted small">
                      {job.openings} opening{job.openings === 1 ? "" : "s"} · posted{" "}
                      {formatDate(job.created_at)}
                    </span>
                  </div>

                  <Link to={`/recruiter/jobs/${job.id}/applicants`} className="recruiter-job-stat">
                    <strong>{job.application_count}</strong>
                    <span>applicant{job.application_count === 1 ? "" : "s"}</span>
                  </Link>

                  <div className="row-actions row-actions-wrap">
                    <Link
                      to={`/recruiter/jobs/${job.id}/applicants`}
                      className="btn btn-secondary btn-small"
                    >
                      Review
                    </Link>
                    {job.status !== "closed" ? (
                      <Link
                        to={`/recruiter/jobs/${job.id}/edit`}
                        className="icon-button"
                        aria-label={`Edit ${job.title}`}
                      >
                        <Icon name="edit" size={16} />
                      </Link>
                    ) : null}
                    {transitions.map((target) => (
                      <button
                        key={target}
                        type="button"
                        className={`btn btn-small ${
                          target === "closed" ? "btn-ghost" : "btn-ghost"
                        }`}
                        disabled={busyId === job.id}
                        onClick={() => changeStatus(job, target)}
                      >
                        {transitionLabel(job.status, target)}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="icon-button danger"
                      aria-label={`Delete ${job.title}`}
                      onClick={() => setDeleteTarget(job)}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon="briefcase"
            title={query || status !== "all" ? "No jobs match those filters" : "No jobs yet"}
            description={
              query || status !== "all"
                ? "Try a different status or search term."
                : "Publish your first role and start meeting candidates."
            }
            action={
              <Link to="/recruiter/jobs/new" className="btn btn-primary btn-small">
                Post a job
              </Link>
            }
          />
        )}
      </SectionCard>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this job?"
        message={
          deleteTarget
            ? `“${deleteTarget.title}” and its ${deleteTarget.application_count} application${
                deleteTarget.application_count === 1 ? "" : "s"
              } will be permanently removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete job"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
