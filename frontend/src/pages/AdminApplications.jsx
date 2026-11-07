import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, buildQuery } from "../api";
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
import { errorMessage, formatDate, formatDateTime, relativeTime, titleCase } from "../format";
import { useMeta } from "../useMeta";

export default function AdminApplications() {
  const meta = useMeta();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get("status") || "";
  const q = searchParams.get("q") || "";

  const [searchDraft, setSearchDraft] = useState(q);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailTarget, setDetailTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [nextStatus, setNextStatus] = useState("");
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get(
        `/admin/applications${buildQuery({
          status: status || undefined,
          q: q || undefined,
        })}`,
      )
      .then((data) => setApplications(data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [status, q]);

  useEffect(load, [load]);

  const counts = useMemo(() => {
    const result = { all: applications.length };
    applications.forEach((application) => {
      result[application.status] = (result[application.status] || 0) + 1;
    });
    return result;
  }, [applications]);

  const tabs = useMemo(() => {
    const base = [{ value: "", label: "All", count: counts.all }];
    (meta.application_statuses || []).forEach((item) => {
      if (counts[item.value]) {
        base.push({ value: item.value, label: item.label, count: counts[item.value] });
      }
    });
    return base;
  }, [counts, meta.application_statuses]);

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
      const updated = await api.patch(`/admin/applications/${statusTarget.id}/status`, {
        status: nextStatus,
        note: note.trim() || null,
      });
      setApplications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      if (detailTarget?.id === updated.id) setDetailTarget(updated);
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

  const transitions = statusTarget
    ? meta.application_status_transitions?.[statusTarget.status] || []
    : [];

  return (
    <div className="container page">
      <PageHeader
        eyebrow="Application oversight"
        title="Every candidate, every decision."
        description="Follow the full hiring pipeline across all companies, search for a person or role, and correct a stage when needed."
        actions={
          <button type="button" className="btn btn-secondary" onClick={load}>
            <Icon name="sparkles" size={16} /> Refresh
          </button>
        }
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      <div className="filter-tabs" role="tablist" aria-label="Filter applications by status">
        {tabs.map((tab) => (
          <button
            key={tab.value || "all"}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            className={`filter-tab ${status === tab.value ? "active" : ""}`}
            onClick={() => updateParams({ status: tab.value })}
          >
            {tab.label}
            <span>{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="admin-toolbar-card">
        <form className="toolbar-search" onSubmit={submitSearch}>
          <label className="search-input">
            <Icon name="search" size={17} />
            <input
              type="search"
              placeholder="Search candidate, email or job title"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              aria-label="Search applications"
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
          <Loading label="Loading applications…" />
        ) : applications.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Applied</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => {
                  const allowed = meta.application_status_transitions?.[application.status] || [];
                  return (
                    <tr key={application.id}>
                      <td>
                        <div className="table-person">
                          <span className="avatar avatar-sm">
                            {(application.candidate.full_name || "?").slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <strong>{application.candidate.full_name}</strong>
                            <span>{application.candidate.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Link to={`/jobs/${application.job.id}`} className="job-link">
                          {application.job.title}
                        </Link>
                        <div className="table-sub">{application.job.company_name}</div>
                      </td>
                      <td>
                        <StatusBadge status={application.status} />
                      </td>
                      <td>
                        <span className="table-sub">{formatDate(application.created_at)}</span>
                      </td>
                      <td>
                        <span className="table-sub">
                          {relativeTime(application.updated_at)}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-small"
                            onClick={() => setDetailTarget(application)}
                          >
                            Details
                          </button>
                          {allowed.length ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-small"
                              onClick={() => openStatusModal(application)}
                            >
                              Move stage
                            </button>
                          ) : (
                            <span className="tag">Final</span>
                          )}
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
            icon="file"
            title={status || q ? "No applications match those filters" : "No applications yet"}
            description={
              status || q
                ? "Try a different stage or search term."
                : "When candidates apply, every application appears here for platform oversight."
            }
          />
        )}
      </SectionCard>

      <SectionCard
        title="Pipeline integrity"
        subtitle="The same transition rules apply to admins."
        className="application-help"
      >
        <div className="help-row">
          <span className="side-tip-icon">
            <Icon name="shield" size={18} />
          </span>
          <div>
            <strong>Applied → Shortlisted → Interview → Offered → Hired</strong>
            <p>
              Rejection is possible from every active stage. Hired, rejected and withdrawn are final.
              Admins can step in when a recruiter is unavailable, but cannot skip a stage.
            </p>
          </div>
        </div>
      </SectionCard>

      <Modal
        open={Boolean(detailTarget)}
        title={detailTarget ? detailTarget.candidate.full_name : "Application"}
        subtitle={
          detailTarget
            ? `${detailTarget.job.title} · ${detailTarget.job.company_name}`
            : ""
        }
        onClose={() => setDetailTarget(null)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDetailTarget(null)}
            >
              Close
            </button>
            {detailTarget &&
            (meta.application_status_transitions?.[detailTarget.status] || []).length ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  openStatusModal(detailTarget);
                  setDetailTarget(null);
                }}
              >
                Move stage <Icon name="arrowRight" size={15} />
              </button>
            ) : null}
          </>
        }
      >
        {detailTarget ? (
          <div className="profile-mini">
            <div className="profile-mini-head">
              <span className="avatar avatar-md">
                {(detailTarget.candidate.full_name || "?").slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{detailTarget.candidate.headline || "Candidate profile"}</strong>
                <p className="muted small">
                  {detailTarget.candidate.email}
                  {detailTarget.candidate.location
                    ? ` · ${detailTarget.candidate.location}`
                    : ""}
                </p>
              </div>
              <StatusBadge status={detailTarget.status} />
            </div>

            <div className="user-detail-grid">
              <div>
                <span>Job</span>
                <strong>{detailTarget.job.title}</strong>
              </div>
              <div>
                <span>Company</span>
                <strong>{detailTarget.job.company_name}</strong>
              </div>
              <div>
                <span>Applied</span>
                <strong>{formatDateTime(detailTarget.created_at)}</strong>
              </div>
              <div>
                <span>Resume</span>
                <strong>
                  {detailTarget.candidate.resume_available ? "Available" : "Not uploaded"}
                </strong>
              </div>
            </div>

            {detailTarget.candidate.skills?.length ? (
              <div>
                <h3 className="small">Skills</h3>
                <div className="tag-row">
                  {detailTarget.candidate.skills.slice(0, 30).map((skill) => (
                    <span className="tag" key={skill}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <h3 className="small">Cover note</h3>
              <p className="muted small long-text">
                {detailTarget.cover_letter || "No cover note was included."}
              </p>
            </div>

            <div>
              <h3 className="small">Timeline</h3>
              <ol className="timeline">
                {(detailTarget.history || []).map((entry, index) => (
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
        ) : null}
      </Modal>

      <Modal
        open={Boolean(statusTarget)}
        title={
          statusTarget
            ? `Move ${statusTarget.candidate.full_name} forward`
            : "Move application"
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
              form="admin-status-form"
              className="btn btn-primary"
              disabled={updating}
            >
              {updating ? "Updating…" : "Update status"}
            </button>
          </>
        }
      >
        <ErrorBanner message={error} onClose={() => setError("")} />
        <form id="admin-status-form" className="form-stack" onSubmit={submitStatus}>
          <label className="field">
            <span className="field-label">Next stage</span>
            <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
              {transitions.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </select>
            <span className="field-hint">
              Only valid next stages are shown. Final stages cannot be changed.
            </span>
          </label>
          <label className="field">
            <span className="field-label">Note (optional)</span>
            <textarea
              rows={4}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Explain the change for the candidate and recruiter."
            />
          </label>
        </form>
      </Modal>
    </div>
  );
}
