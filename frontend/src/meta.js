export const FALLBACK_META = {
  roles: ["candidate", "recruiter", "admin"],
  user_statuses: ["active", "disabled"],
  employment_types: [
    { value: "full-time", label: "Full-time" },
    { value: "part-time", label: "Part-time" },
    { value: "contract", label: "Contract" },
    { value: "internship", label: "Internship" },
    { value: "freelance", label: "Freelance" },
  ],
  job_statuses: [
    { value: "draft", label: "Draft" },
    { value: "open", label: "Open" },
    { value: "closed", label: "Closed" },
  ],
  application_statuses: [
    { value: "applied", label: "Applied" },
    { value: "shortlisted", label: "Shortlisted" },
    { value: "interview", label: "Interview" },
    { value: "offered", label: "Offered" },
    { value: "hired", label: "Hired" },
    { value: "rejected", label: "Rejected" },
    { value: "withdrawn", label: "Withdrawn" },
  ],
  job_status_transitions: {
    draft: ["open", "closed"],
    open: ["closed"],
    closed: ["open"],
  },
  application_status_transitions: {
    applied: ["shortlisted", "rejected", "withdrawn"],
    shortlisted: ["interview", "rejected", "withdrawn"],
    interview: ["offered", "rejected"],
    offered: ["hired", "rejected"],
    hired: [],
    rejected: [],
    withdrawn: [],
  },
  withdrawable_application_statuses: ["applied", "shortlisted"],
  limits: {
    password_min_length: 8,
    resume_max_size_mb: 5,
    resume_extensions: ["doc", "docx", "pdf"],
    page_size_default: 10,
    page_size_max: 50,
    max_job_openings: 100,
    admin_registration_requires_invite: true,
  },
};

let cachedMeta = null;
let pendingRequest = null;

export function getCachedMeta() {
  return cachedMeta || FALLBACK_META;
}

export function preloadMeta() {
  if (cachedMeta) return Promise.resolve(cachedMeta);
  if (!pendingRequest) {
    pendingRequest = import("./api")
      .then(({ api }) => api.get("/meta/options"))
      .then((data) => {
        cachedMeta = data;
        return data;
      })
      .catch(() => FALLBACK_META)
      .finally(() => {
        pendingRequest = null;
      });
  }
  return pendingRequest;
}
