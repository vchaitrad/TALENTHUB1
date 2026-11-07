import { titleCase } from "../format";

export default function StatusBadge({ status, label, dot = true }) {
  if (!status) return null;
  return (
    <span className={`status-badge status-${status}`}>
      {dot ? <span className="status-dot" aria-hidden="true" /> : null}
      {label || titleCase(status)}
    </span>
  );
}
