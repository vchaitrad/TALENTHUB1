import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { deadlineLabel, errorMessage, formatDate, titleCase } from "../format";
import { useMeta } from "../useMeta";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "draft", label: "Draft" },
  { value: "closed", label: "Closed" },
];

function transitionLabel(current, target) {
  if (target === "open") return current === "closed" ? "Reopen" : "Publish";
  if (target === "closed") return "Close";
  return `Mark ${titleCase(target)}`;
}

export default function AdminJobs() {
  const meta = useMeta();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get("status") || "";
  const q = searchParams.get("q") || "";

  const [searchDraft, setSearchDraft] = useState(q);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get(
        `/admin/jobs${buildQuery({
          status: status || undefined,
          q: q || undefined,
        })}`,
      )
      .then((data) => setJobs(data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [status, q]);

  useEffect(load, [load]);

  const counts = useMemo(() => {
    const result = { all: jobs.length, open: 0, draft: 0, closed: 0 };
    jobs.forEach((job) => {
      result[job.status] = (result[job.status] || 0) + 1;
    });
    return result;
  }, [jobs]);

  const updateParams = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next, { replace: true });
  };

  const submitSearch = (event) => {
    event.preventDefault();
    updateParams({ q: searchDraft.trim() });
  };

  const changeStatus = async (job, target) => {
    setBusyId(job.id);
    setError("");
    try {
      const updated = await api.patch(`/admin/jobs/${job.id}/status`, { status: target });
      setJobs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      showToast(`"${job.title}" is now ${target}.`, "success");
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
      await api.delete(`/admin/jobs/${deleteTarget.id}`);
      setJobs((current) => current.filter((item) => item.id !== deleteTarget.id));
      showToast(`"${deleteTarget.title}" was deleted.`, "success");
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
        eyebrow="Job management"
        title="Every posting, across every company."
        description="Close expired roles, reopen healthy ones and remove posts that should not be on the platform."
        actions={
          <button type="button" className="btn btn-secondary" onClick={load}>
            <Icon name="sparkles" size={16} /> Refresh
          </button>
        }
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      <div className="filter-tabs" role="tablist" aria-label="Filter jobs by status">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value || "all"}
            type="button"
            role="tab"
            aria-selected={status === option.value}
            className={`filter-tab ${status === option.value ? "active" : ""}`}
            onClick={() => updateParams({ status: option.value })}
          >
            {option.label}
            <span>{option.value ? counts[option.value] || 0 : counts.all}</span>
          </button>
        ))}
      </div>

      <div className="admin-toolbar-card">
        <form className="toolbar-search" onSubmit={submitSearch}>
          <label className="search-input">
            <Icon name="search" size={17} />
            <input
              type="search"
              placeholder="Search by job title or company"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              aria-label="Search jobs"
            />
          </label>
          <button type="submit" className="btn btn-secondary btn-small">
            Search
          </button>
        </form>
        {status || q ? (
          <button
            type="button"
            className="clear-filters"
            onClick={() => setSearchParams({}, { replace: true })}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <SectionCard>
        {loading ? (
          <Loading label="Loading jobs…" />
        ) : jobs.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Company</th>
                  <th>Recruiter</th>
                  <th>Status</th>
                  <th>Applicants</th>
                  <th>Deadline</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const transitions = meta.job_status_transitions?.[job.status] || [];
                  return (
                    <tr key={job.id}>
                      <td>
                        <Link to={`/jobs/${job.id}`} className="job-link">
                          {job.title}
                        </Link>
                        <div className="table-sub">
                          {job.location} · {titleCase(job.employment_type)}
                        </div>
                      </td>
                      <td>
                        <div className="table-person">
                          <span className="company-mark">
                            {(job.company?.name || "?").slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <strong>{job.company?.name || "—"}</strong>
                            <span>{job.company?.industry || "Company"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="table-sub">
                          <strong>{job.recruiter?.full_name || "—"}</strong>
                          <br />
                          {job.recruiter?.email || ""}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={job.status} />
                        {job.is_expired && job.status === "open" ? (
                          <div className="tag tag-warn" style={{ marginTop: 4 }}>
                            Deadline passed
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <Link to={`/admin/applications?q=${encodeURIComponent(job.title)}`}>
                          {job.application_count}
                        </Link>
                      </td>
                      <td>
                        <div className="table-sub">
                          {formatDate(job.deadline)}
                          <br />
                          {deadlineLabel(job.deadline)}
                        </div>
                      </td>
                      <td>
                        <div className="table-actions">
                          {transitions.map((target) => (
                            <button
                              key={target}
                              type="button"
                              className="btn btn-ghost btn-small"
                              disabled={busyId === job.id}
                              onClick={() => changeStatus(job, target)}
                            >
                              {transitionLabel(job.status, target)}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="icon-button danger"
                            title="Delete job"
                            aria-label={`Delete ${job.title}`}
                            onClick={() => setDeleteTarget(job)}
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="briefcase"
            title={status || q ? "No jobs match those filters" : "No jobs on the platform yet"}
            description={
              status || q
                ? "Try a different status or search term."
                : "Jobs posted by recruiters will appear here for review."
            }
          />
        )}
      </SectionCard>

      <SectionCard
        title="Job lifecycle"
        subtitle="Status changes are enforced by one shared state machine."
        className="application-help"
      >
        <div className="help-row">
          <span className="side-tip-icon">
            <Icon name="shield" size={18} />
          </span>
          <div>
            <strong>Draft → Open → Closed, and Closed → Open</strong>
            <p>
              A job can only be reopened while its deadline is still in the future. Deleting a job
              also removes every application attached to it, so close a role instead of deleting it
              when you need the history.
            </p>
          </div>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this job?"
        message={
          deleteTarget
            ? `"${deleteTarget.title}" at ${deleteTarget.company?.name || "its company"} and its ${deleteTarget.application_count} application${
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
