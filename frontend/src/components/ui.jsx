import Icon from "./Icons";

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, helper, icon = "chart", tone = "teal" }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon">
          <Icon name={icon} size={18} />
        </span>
      </div>
      <div className="stat-value">{value}</div>
      {helper ? <div className="stat-helper">{helper}</div> : null}
    </div>
  );
}

export function EmptyState({ icon = "sparkles", title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function Spinner({ size = 20, label }) {
  return (
    <span className="spinner-wrap">
      <span
        className="spinner"
        style={{ width: size, height: size }}
        role="status"
        aria-label={label || "Loading"}
      />
      {label ? <span>{label}</span> : null}
    </span>
  );
}

export function Loading({ label = "Loading…" }) {
  return (
    <div className="loading-block">
      <Spinner label={label} />
    </div>
  );
}

export function ErrorBanner({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="alert alert-error">
      <span>{message}</span>
      {onClose ? (
        <button type="button" className="alert-close" onClick={onClose} aria-label="Dismiss">
          <Icon name="close" size={14} />
        </button>
      ) : null}
    </div>
  );
}

export function SuccessBanner({ message }) {
  if (!message) return null;
  return (
    <div className="alert alert-success">
      <span>{message}</span>
    </div>
  );
}

export function Field({ label, hint, error, required, children, className = "" }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">
        {label}
        {required ? <span className="required">*</span> : null}
      </span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

export function Avatar({ name, size = "md" }) {
  return <span className={`avatar avatar-${size}`}>{initials(name)}</span>;
}

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function SectionCard({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      {title || action ? (
        <div className="panel-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", onConfirm, onCancel, danger }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="modal modal-small"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-body">
          <h3>{title}</h3>
          <p className="muted">{message}</p>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
