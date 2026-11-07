import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import Icon from "../components/Icons";
import {
  ErrorBanner,
  Loading,
  PageHeader,
  SectionCard,
  StatCard,
} from "../components/ui";
import { errorMessage, relativeTime, titleCase } from "../format";

function Breakdown({ data, tone }) {
  const entries = Object.entries(data || {});
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const max = Math.max(1, ...entries.map(([, value]) => value));
  if (!entries.length) {
    return <p className="muted small">No data yet.</p>;
  }
  return (
    <div className="admin-bars">
      {entries.map(([key, value]) => (
        <div className="admin-bar-row" key={key}>
          <span>{titleCase(key)}</span>
          <div className="admin-bar-track">
            <div
              className={`admin-bar-fill tone-${tone(key, entries)}`}
              style={{ width: `${total ? Math.max(2, (value / max) * 100) : 2}%` }}
            />
          </div>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

const STATUS_TONES = {
  applied: "blue",
  shortlisted: "green",
  interview: "amber",
  offered: "purple",
  hired: "green",
  rejected: "red",
  withdrawn: "grey",
  open: "green",
  draft: "grey",
  closed: "red",
};

function toneFor(key) {
  return STATUS_TONES[key] || "green";
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/admin/stats")
      .then((data) => {
        if (active) setStats(data);
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
        <Loading label="Loading platform statistics…" />
      </div>
    );
  }

  const firstName = (user?.full_name || "Admin").split(" ")[0];
  const usersByRole = stats?.users_by_role || {};
  const jobsByStatus = stats?.jobs_by_status || {};
  const applicationsByStatus = stats?.applications_by_status || {};

  return (
    <div className="container page">
      <PageHeader
        eyebrow="Admin console"
        title={`Platform health at a glance, ${firstName}.`}
        description="Manage accounts, keep job posts honest and follow every application as it moves through the hiring pipeline."
        actions={
          <>
            <Link to="/admin/users" className="btn btn-secondary">
              <Icon name="users" size={16} /> Manage users
            </Link>
            <Link to="/admin/jobs" className="btn btn-primary">
              <Icon name="briefcase" size={16} /> Manage jobs
            </Link>
          </>
        }
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      <div className="stat-grid">
        <StatCard
          label="Total users"
          value={stats?.users_total ?? 0}
          helper="candidates, recruiters and admins"
          icon="users"
          tone="teal"
        />
        <StatCard
          label="Candidates"
          value={usersByRole.candidate ?? 0}
          helper="people looking for work"
          icon="sparkles"
          tone="blue"
        />
        <StatCard
          label="Jobs"
          value={stats?.jobs_total ?? 0}
          helper={`${jobsByStatus.open ?? 0} currently open`}
          icon="briefcase"
          tone="green"
        />
        <StatCard
          label="Applications"
          value={stats?.applications_total ?? 0}
          helper={`${applicationsByStatus.hired ?? 0} hires so far`}
          icon="file"
          tone="amber"
        />
      </div>

      <div className="admin-section-grid">
        <SectionCard title="Users by role" subtitle="Who makes up the platform.">
          <Breakdown data={usersByRole} tone={(key) => (key === "admin" ? "amber" : key === "recruiter" ? "green" : "blue")} />
        </SectionCard>

        <SectionCard title="Jobs by status" subtitle="Supply across the marketplace.">
          <Breakdown data={jobsByStatus} tone={toneFor} />
        </SectionCard>

        <SectionCard title="Applications by stage" subtitle="Where candidates sit today.">
          <Breakdown data={applicationsByStatus} tone={toneFor} />
        </SectionCard>
      </div>

      <SectionCard
        title="Quick actions"
        subtitle="Jump straight to the area that needs attention."
        className="next-move-card"
      >
        <div className="admin-quick-grid">
          <Link to="/admin/users?role=recruiter" className="admin-quick">
            <Icon name="building" size={18} /> Recruiter accounts
          </Link>
          <Link to="/admin/users?status=disabled" className="admin-quick">
            <Icon name="shield" size={18} /> Disabled accounts
          </Link>
          <Link to="/admin/jobs?status=open" className="admin-quick">
            <Icon name="briefcase" size={18} /> Open jobs
          </Link>
          <Link to="/admin/applications?status=interview" className="admin-quick">
            <Icon name="calendar" size={18} /> Interviews in progress
          </Link>
        </div>
      </SectionCard>

      <p className="dashboard-footnote">
        Platform snapshot generated {relativeTime(new Date().toISOString())}. Every action you take is
        checked by the same business rules that protect candidates and recruiters.
      </p>
    </div>
  );
}
