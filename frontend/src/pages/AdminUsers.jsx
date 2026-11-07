import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, buildQuery } from "../api";
import { useAuth } from "../auth/AuthContext";
import Icon from "../components/Icons";
import Modal from "../components/Modal";
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
import { errorMessage, formatDate, roleLabel, titleCase } from "../format";

const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "candidate", label: "Candidates" },
  { value: "recruiter", label: "Recruiters" },
  { value: "admin", label: "Admins" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
];

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const role = searchParams.get("role") || "";
  const status = searchParams.get("status") || "";
  const q = searchParams.get("q") || "";

  const [searchDraft, setSearchDraft] = useState(q);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [profileTarget, setProfileTarget] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get(
        `/admin/users${buildQuery({
          role: role || undefined,
          status: status || undefined,
          q: q || undefined,
        })}`,
      )
      .then((data) => setUsers(data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [role, status, q]);

  useEffect(load, [load]);

  const counts = useMemo(() => {
    const result = { all: users.length, candidate: 0, recruiter: 0, admin: 0, active: 0, disabled: 0 };
    users.forEach((item) => {
      result[item.role] = (result[item.role] || 0) + 1;
      result[item.status] = (result[item.status] || 0) + 1;
    });
    return result;
  }, [users]);

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

  const toggleStatus = async (target) => {
    const nextStatus = target.status === "active" ? "disabled" : "active";
    setBusyId(target.id);
    setError("");
    try {
      const updated = await api.patch(`/admin/users/${target.id}/status`, {
        status: nextStatus,
      });
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      showToast(
        `${updated.full_name} is now ${nextStatus === "active" ? "active" : "disabled"}.`,
        "success",
      );
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
      await api.delete(`/admin/users/${deleteTarget.id}`);
      setUsers((current) => current.filter((item) => item.id !== deleteTarget.id));
      showToast(`${deleteTarget.full_name} was deleted.`, "success");
      setDeleteTarget(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const openProfile = async (target) => {
    setProfileTarget(target);
    setProfile(null);
    setProfileLoading(true);
    setError("");
    try {
      const data = await api.get(`/admin/candidates/${target.id}/profile`);
      setProfile(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <div className="container page">
      <PageHeader
        eyebrow="User management"
        title="The people behind every application."
        description="Search accounts, review candidate profiles, disable access when needed and remove accounts that should no longer exist."
        actions={
          <button type="button" className="btn btn-secondary" onClick={load}>
            <Icon name="sparkles" size={16} /> Refresh
          </button>
        }
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      <div className="filter-tabs" role="tablist" aria-label="Filter users by role">
        {ROLE_OPTIONS.map((option) => (
          <button
            key={option.value || "all"}
            type="button"
            role="tab"
            aria-selected={role === option.value}
            className={`filter-tab ${role === option.value ? "active" : ""}`}
            onClick={() => updateParams({ role: option.value })}
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
              placeholder="Search by name or email"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              aria-label="Search users"
            />
          </label>
          <button type="submit" className="btn btn-secondary btn-small">
            Search
          </button>
        </form>
        <select
          value={status}
          onChange={(event) => updateParams({ status: event.target.value })}
          aria-label="Filter by account status"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {role || status || q ? (
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
          <Loading label="Loading accounts…" />
        ) : users.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Activity</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((account) => {
                  const isSelf = account.id === currentUser?.id;
                  return (
                    <tr key={account.id}>
                      <td>
                        <div className="table-person">
                          <span className="avatar avatar-sm">
                            {(account.full_name || "?").slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <strong>
                              {account.full_name}
                              {isSelf ? " (you)" : ""}
                            </strong>
                            <span>{account.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`role-pill role-${account.role}`}>
                          {roleLabel(account.role)}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={account.status} label={titleCase(account.status)} />
                      </td>
                      <td>
                        <span className="table-sub">
                          {account.role === "recruiter"
                            ? `${account.jobs_count} job${account.jobs_count === 1 ? "" : "s"}`
                            : account.role === "candidate"
                              ? `${account.applications_count} application${
                                  account.applications_count === 1 ? "" : "s"
                                }`
                              : "Platform administration"}
                        </span>
                      </td>
                      <td>
                        <span className="table-sub">{formatDate(account.created_at)}</span>
                      </td>
                      <td>
                        <div className="table-actions">
                          {account.role === "candidate" ? (
                            <button
                              type="button"
                              className="icon-button"
                              title="View candidate profile"
                              aria-label={`View ${account.full_name}'s profile`}
                              onClick={() => openProfile(account)}
                            >
                              <Icon name="file" size={15} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-ghost btn-small"
                            disabled={busyId === account.id || isSelf}
                            title={isSelf ? "You cannot change your own account" : undefined}
                            onClick={() => toggleStatus(account)}
                          >
                            {account.status === "active" ? "Disable" : "Enable"}
                          </button>
                          <button
                            type="button"
                            className="icon-button danger"
                            title="Delete account"
                            aria-label={`Delete ${account.full_name}`}
                            disabled={isSelf}
                            onClick={() => setDeleteTarget(account)}
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
            icon="users"
            title={q || role || status ? "No accounts match those filters" : "No accounts yet"}
            description={
              q || role || status
                ? "Try a different role, status or search term."
                : "Registered candidates, recruiters and admins will appear here."
            }
          />
        )}
      </SectionCard>

      <SectionCard
        title="Account safety"
        subtitle="Two rules keep the platform recoverable."
        className="application-help"
      >
        <div className="help-row">
          <span className="side-tip-icon">
            <Icon name="shield" size={18} />
          </span>
          <div>
            <strong>Admins cannot disable or delete their own account</strong>
            <p>
              At least one administrator always keeps access. Disabled users are blocked from
              logging in, but their history stays intact until an admin removes the account.
            </p>
          </div>
        </div>
      </SectionCard>

      <Modal
        open={Boolean(profileTarget)}
        title={profileTarget ? `${profileTarget.full_name}'s profile` : "Candidate profile"}
        subtitle={profileTarget?.email}
        onClose={() => {
          setProfileTarget(null);
          setProfile(null);
        }}
        footer={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setProfileTarget(null);
              setProfile(null);
            }}
          >
            Close
          </button>
        }
      >
        {profileLoading ? (
          <Loading label="Loading profile…" />
        ) : profile ? (
          <div className="profile-mini">
            <div className="profile-mini-head">
              <span className="avatar avatar-md">
                {(profile.user?.full_name || "?").slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{profile.headline || "Candidate profile"}</strong>
                <p className="muted small">
                  {profile.location || "Location not set"} · Joined{" "}
                  {formatDate(profile.user?.created_at || profile.updated_at)}
                </p>
              </div>
            </div>

            <div className="user-detail-grid">
              <div>
                <span>Phone</span>
                <strong>{profile.phone || "Not provided"}</strong>
              </div>
              <div>
                <span>Resume</span>
                <strong>{profile.has_resume ? "Uploaded" : "Not uploaded"}</strong>
              </div>
              <div>
                <span>Applications</span>
                <strong>{profileTarget?.applications_count ?? 0}</strong>
              </div>
              <div>
                <span>Profile updated</span>
                <strong>{formatDate(profile.updated_at)}</strong>
              </div>
            </div>

            <div>
              <h3 className="small">Summary</h3>
              <p className="muted small long-text">
                {profile.summary || "No professional summary added yet."}
              </p>
            </div>

            {profile.skills?.length ? (
              <div>
                <h3 className="small">Skills</h3>
                <div className="tag-row">
                  {profile.skills.map((skill) => (
                    <span className="tag" key={skill}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {profile.experience?.length ? (
              <div>
                <h3 className="small">Experience</h3>
                <ul className="profile-mini-list">
                  {profile.experience.map((item, index) => (
                    <li key={`${item.company}-${index}`}>
                      {item.title} at {item.company}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {profile.education?.length ? (
              <div>
                <h3 className="small">Education</h3>
                <ul className="profile-mini-list">
                  {profile.education.map((item, index) => (
                    <li key={`${item.institution}-${index}`}>
                      {item.degree} · {item.institution}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="muted small">No profile information is available for this candidate.</p>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this account?"
        message={
          deleteTarget
            ? `${deleteTarget.full_name} (${deleteTarget.email}) will be permanently removed along with their profile, jobs and applications. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete account"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
