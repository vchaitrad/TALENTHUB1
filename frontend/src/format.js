export function formatDate(value, options = {}) {
  if (!value) return "—";
  const date = typeof value === "string" && value.length === 10 ? `${value}T00:00:00` : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(new Date(date));
}

export function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatSalary(min, max) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
  });
  const compact = (value) => formatter.format(value).replace("K", "k");
  if (min && max) return `${compact(min)} – ${compact(max)}`;
  if (min) return `From ${compact(min)}`;
  if (max) return `Up to ${compact(max)}`;
  return "Salary not listed";
}

export function salarySuffix(job) {
  return job?.employment_type === "internship" ? "stipend" : "per year";
}

export function daysUntil(deadline) {
  if (!deadline) return null;
  const end = new Date(`${deadline}T23:59:59`);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function deadlineLabel(deadline) {
  const days = daysUntil(deadline);
  if (days === null) return "No deadline";
  if (days < 0) return "Deadline passed";
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  return `Closes in ${days} days`;
}

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function roleLabel(role) {
  if (role === "admin") return "Administrator";
  if (role === "recruiter") return "Recruiter";
  return "Candidate";
}

export function titleCase(value = "") {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function relativeTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size || unit === "minute") {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }
  return "just now";
}

export function errorMessage(error) {
  return error?.message || "Something went wrong. Please try again.";
}
