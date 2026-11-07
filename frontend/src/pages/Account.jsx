import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import Icon from "../components/Icons";
import { useToast } from "../components/Toast";
import {
  ErrorBanner,
  Field,
  PageHeader,
  SectionCard,
  SuccessBanner,
} from "../components/ui";
import { errorMessage, formatDate, roleLabel } from "../format";

export default function Account() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Your password has been updated. Use it the next time you log in.");
      showToast("Password updated.", "success");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container page">
      <PageHeader
        eyebrow="Account"
        title="Your TalentHub account."
        description="Manage the details tied to your login and keep your account secure."
      />

      <div className="profile-layout account-layout">
        <div className="profile-main">
          <SectionCard title="Account details" subtitle="These details identify you on TalentHub.">
            <dl className="account-details">
              <div>
                <dt>Full name</dt>
                <dd>{user.full_name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{roleLabel(user.role)}</dd>
              </div>
              <div>
                <dt>Account status</dt>
                <dd className="capitalize">{user.status}</dd>
              </div>
              <div>
                <dt>Member since</dt>
                <dd>{formatDate(user.created_at)}</dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard
            title="Change password"
            subtitle="Use your current password to choose a new one."
          >
            <ErrorBanner message={error} onClose={() => setError("")} />
            <SuccessBanner message={success} />
            <form className="form-stack" onSubmit={submit}>
              <Field label="Current password" required>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                />
              </Field>
              <div className="form-grid-two">
                <Field label="New password" hint="At least 8 characters" required>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </Field>
                <Field label="Confirm new password" required>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </Field>
              </div>
              <div className="form-submit-row">
                <span className="muted">You will stay signed in after changing your password.</span>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Updating…" : "Update password"}
                </button>
              </div>
            </form>
          </SectionCard>
        </div>

        <aside className="profile-side">
          <section className="profile-identity">
            <span className="avatar avatar-lg">{user.full_name.slice(0, 1)}</span>
            <div>
              <strong>{user.full_name}</strong>
              <span>{user.email}</span>
              <small>{roleLabel(user.role)} account</small>
            </div>
          </section>

          <section className="side-tip">
            <span className="side-tip-icon">
              <Icon name="shield" size={18} />
            </span>
            <div>
              <strong>Keep your account safe</strong>
              <ul className="tips-list">
                <li>Use a password you do not reuse elsewhere.</li>
                <li>Never share your admin invite code.</li>
                <li>Sign out when using a shared computer.</li>
              </ul>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
