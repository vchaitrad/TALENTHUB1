import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import Icon from "../components/Icons";
import StatusBadge from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import {
  ErrorBanner,
  Field,
  Loading,
  PageHeader,
  SectionCard,
} from "../components/ui";
import { errorMessage, formatDate } from "../format";
import { useMeta } from "../useMeta";

const LEVELS = ["Intern", "Junior", "Mid-level", "Senior", "Lead", "Manager", "Director"];

function isoDate(date) {
  const copy = new Date(date.getTime());
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function defaultDeadline() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return isoDate(date);
}

const EMPTY_FORM = {
  title: "",
  description: "",
  location: "",
  employment_type: "full-time",
  experience_level: "Mid-level",
  salary_min: "",
  salary_max: "",
  skillsText: "",
  openings: "1",
  deadline: defaultDeadline(),
  status: "open",
};

export default function RecruiterJobForm() {
  const { jobId } = useParams();
  const isEdit = Boolean(jobId);
  const navigate = useNavigate();
  const meta = useMeta();
  const { showToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [job, setJob] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [companyMissing, setCompanyMissing] = useState(false);

  useEffect(() => {
    let active = true;
    const requests = [api.get("/recruiter/company")];
    if (isEdit) requests.push(api.get(`/recruiter/jobs/${jobId}`));

    Promise.all(requests)
      .then(([companyData, jobData]) => {
        if (!active) return;
        setCompany(companyData);
        if (!companyData) setCompanyMissing(true);
        if (jobData) {
          setJob(jobData);
          setForm({
            title: jobData.title || "",
            description: jobData.description || "",
            location: jobData.location || "",
            employment_type: jobData.employment_type || "full-time",
            experience_level: jobData.experience_level || "Mid-level",
            salary_min: jobData.salary_min ?? "",
            salary_max: jobData.salary_max ?? "",
            skillsText: (jobData.skills_required || []).join(", "),
            openings: String(jobData.openings ?? 1),
            deadline: jobData.deadline || defaultDeadline(),
            status: jobData.status || "open",
          });
        }
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
  }, [isEdit, jobId]);

  const levelOptions = useMemo(() => {
    if (form.experience_level && !LEVELS.includes(form.experience_level)) {
      return [form.experience_level, ...LEVELS];
    }
    return LEVELS;
  }, [form.experience_level]);

  const set = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      employment_type: form.employment_type,
      experience_level: form.experience_level.trim() || "Mid-level",
      salary_min: form.salary_min === "" ? null : Number(form.salary_min),
      salary_max: form.salary_max === "" ? null : Number(form.salary_max),
      skills_required: form.skillsText
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
      openings: Number(form.openings || 1),
      deadline: form.deadline,
      ...(isEdit ? {} : { status: form.status }),
    };

    try {
      if (isEdit) {
        const updated = await api.put(`/recruiter/jobs/${jobId}`, payload);
        setJob(updated);
        showToast("Job updated.", "success");
        navigate("/recruiter/jobs");
      } else {
        const created = await api.post("/recruiter/jobs", payload);
        showToast(
          created.status === "open"
            ? "Job published. Candidates can apply now."
            : "Draft saved. Publish it when you are ready.",
          "success",
        );
        navigate("/recruiter/jobs");
      }
    } catch (err) {
      setError(errorMessage(err));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container page">
        <Loading label="Loading the job form…" />
      </div>
    );
  }

  if (isEdit && !job && !error) {
    return (
      <div className="container page">
        <div className="empty-state">
          <h2>Job not found</h2>
          <p>This job may have been deleted or belongs to another recruiter.</p>
          <Link to="/recruiter/jobs" className="btn btn-primary">
            Back to my jobs
          </Link>
        </div>
      </div>
    );
  }

  if (!company && companyMissing) {
    return (
      <div className="container page">
        <PageHeader
          eyebrow="Post a job"
          title="One step first: your company profile."
          description="Every job must belong to a company candidates can recognise."
        />
        <section className="onboarding-banner">
          <span className="onboarding-icon">
            <Icon name="building" size={24} />
          </span>
          <div>
            <h2>Create your company profile</h2>
            <p>Add your company name and details, then come back to publish this role.</p>
          </div>
          <Link to="/recruiter/company" className="btn btn-accent">
            Set up company <Icon name="arrowRight" size={16} />
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="container page">
      <Link to="/recruiter/jobs" className="back-link">
        <Icon name="arrowLeft" size={16} /> My jobs
      </Link>

      <PageHeader
        eyebrow={isEdit ? "Edit job" : "Post a job"}
        title={isEdit ? "Refine the role." : "Describe the role you need to fill."}
        description={
          isEdit
            ? "Clear requirements and a realistic deadline attract the right applicants."
            : "Candidates can only apply while the job is open and before its deadline."
        }
        actions={
          <>
            <Link to="/recruiter/jobs" className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" form="job-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : form.status === "open" ? "Publish job" : "Save draft"}
            </button>
          </>
        }
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      {isEdit && job ? (
        <div className="job-form-status">
          <div>
            <span className="muted small">Current status</span>
            <StatusBadge status={job.status} />
          </div>
          <span className="muted small">
            Posted {formatDate(job.created_at)} · {job.application_count} applicant
            {job.application_count === 1 ? "" : "s"}
          </span>
        </div>
      ) : null}

      {isEdit && job?.status === "closed" ? (
        <div className="notice notice-amber">
          <Icon name="clock" size={18} />
          <span>
            This job is closed and cannot be edited. Reopen it from the jobs list first, or ask an
            admin for help.
          </span>
        </div>
      ) : null}

      <form id="job-form" className="profile-main job-form" onSubmit={submit}>
        <SectionCard title="Role basics" subtitle="What the job is called and where it lives.">
          <div className="form-grid-two">
            <Field label="Job title" required className="span-2">
              <input
                type="text"
                value={form.title}
                onChange={set("title")}
                placeholder="e.g. Senior Frontend Engineer"
                minLength={3}
                maxLength={120}
                required
              />
            </Field>
            <Field label="Location" required>
              <input
                type="text"
                value={form.location}
                onChange={set("location")}
                placeholder="City, country or Remote"
                minLength={2}
                maxLength={160}
                required
              />
            </Field>
            <Field label="Employment type" required>
              <select value={form.employment_type} onChange={set("employment_type")}>
                {meta.employment_types.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Experience level">
              <select value={form.experience_level} onChange={set("experience_level")}>
                {levelOptions.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Openings" required>
              <input
                type="number"
                min="1"
                max={meta.limits?.max_job_openings || 100}
                value={form.openings}
                onChange={set("openings")}
                required
              />
            </Field>
            <Field label="Application deadline" required hint="Deadline is inclusive.">
              <input
                type="date"
                value={form.deadline}
                min={isoDate(new Date())}
                onChange={set("deadline")}
                required
              />
            </Field>
            {!isEdit ? (
              <Field label="Visibility" hint="Drafts stay private until you publish them.">
                <select value={form.status} onChange={set("status")}>
                  <option value="open">Publish immediately</option>
                  <option value="draft">Save as draft</option>
                </select>
              </Field>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="The role in detail" subtitle="Be specific about the work and the person.">
          <Field
            label="Job description"
            hint={`${form.description.length}/10,000 characters · minimum 30`}
            required
          >
            <textarea
              rows={10}
              value={form.description}
              onChange={set("description")}
              minLength={30}
              maxLength={10000}
              placeholder="What will this person own? What does the team look like? What does success look like in the first six months?"
              required
            />
          </Field>
          <Field
            label="Skills required"
            hint="Comma-separated. These are searchable by candidates."
          >
            <input
              type="text"
              value={form.skillsText}
              onChange={set("skillsText")}
              placeholder="React, TypeScript, accessibility"
            />
          </Field>
          {form.skillsText.trim() ? (
            <div className="tag-row tag-row-lg">
              {form.skillsText
                .split(",")
                .map((skill) => skill.trim())
                .filter(Boolean)
                .slice(0, 12)
                .map((skill) => (
                  <span className="tag tag-large" key={skill}>
                    {skill}
                  </span>
                ))}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Compensation" subtitle="Leave either field blank if the salary is not listed.">
          <div className="form-grid-two">
            <Field label="Minimum salary">
              <input
                type="number"
                min="0"
                max="10000000"
                value={form.salary_min}
                onChange={set("salary_min")}
                placeholder="90000"
              />
            </Field>
            <Field label="Maximum salary">
              <input
                type="number"
                min="0"
                max="10000000"
                value={form.salary_max}
                onChange={set("salary_max")}
                placeholder="130000"
              />
            </Field>
          </div>
          <p className="muted small">The minimum cannot be greater than the maximum.</p>
        </SectionCard>

        <div className="form-submit-row">
          <span className="muted">
            {company ? `Hiring as ${company.name}` : "Company profile required before publishing."}
          </span>
          <div className="inline-actions">
            <Link to="/recruiter/jobs" className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : form.status === "open" ? "Publish job" : "Save draft"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
