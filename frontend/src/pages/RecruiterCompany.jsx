import { useEffect, useState } from "react";
import { api } from "../api";
import Icon from "../components/Icons";
import { useToast } from "../components/Toast";
import {
  ErrorBanner,
  Field,
  Loading,
  PageHeader,
  SectionCard,
} from "../components/ui";
import { errorMessage, formatDate } from "../format";

const EMPTY_FORM = {
  name: "",
  website: "",
  industry: "",
  company_size: "",
  location: "",
  description: "",
};

const SIZE_OPTIONS = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

export default function RecruiterCompany() {
  const { showToast } = useToast();
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/recruiter/company")
      .then((data) => {
        if (!active) return;
        setCompany(data);
        if (data) {
          setForm({
            name: data.name || "",
            website: data.website || "",
            industry: data.industry || "",
            company_size: data.company_size || "",
            location: data.location || "",
            description: data.description || "",
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
  }, []);

  const set = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await api.put("/recruiter/company", {
        name: form.name.trim(),
        website: form.website.trim() || null,
        industry: form.industry.trim() || null,
        company_size: form.company_size.trim() || null,
        location: form.location.trim() || null,
        description: form.description.trim() || null,
      });
      setCompany(updated);
      setForm({
        name: updated.name || "",
        website: updated.website || "",
        industry: updated.industry || "",
        company_size: updated.company_size || "",
        location: updated.location || "",
        description: updated.description || "",
      });
      showToast(
        company ? "Company profile updated." : "Company profile created. You can post jobs now.",
        "success",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container page">
        <Loading label="Loading your company profile…" />
      </div>
    );
  }

  return (
    <div className="container page">
      <PageHeader
        eyebrow="Company profile"
        title={company ? "The face of your hiring team." : "Introduce your company."}
        description={
          company
            ? "Candidates see these details on every job you publish. Keep them accurate and specific."
            : "Add your company details before posting a job. This is what candidates will see alongside your roles."
        }
        actions={
          <>
            <button type="submit" form="company-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : company ? "Save changes" : "Create company profile"}
            </button>
            {company ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => document.getElementById("company-form")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Icon name="briefcase" size={16} /> Edit details
              </button>
            ) : null}
          </>
        }
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      {!company ? (
        <section className="onboarding-banner">
          <span className="onboarding-icon">
            <Icon name="building" size={24} />
          </span>
          <div>
            <h2>One profile, every role</h2>
            <p>
              Your company name, industry and description appear on all of your job posts. You can
              only have one company profile per recruiter account.
            </p>
          </div>
        </section>
      ) : null}

      <div className="profile-layout">
        <form id="company-form" className="profile-main" onSubmit={submit}>
          <SectionCard title="Company basics" subtitle="The details candidates look for first.">
            <div className="form-grid-two">
              <Field label="Company name" required className="span-2">
                <input
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="e.g. TechNova Labs"
                  minLength={2}
                  maxLength={160}
                  required
                />
              </Field>
              <Field label="Website">
                <input
                  type="url"
                  value={form.website}
                  onChange={set("website")}
                  placeholder="https://your-company.com"
                  maxLength={255}
                />
              </Field>
              <Field label="Industry">
                <input
                  type="text"
                  value={form.industry}
                  onChange={set("industry")}
                  placeholder="Software & Cloud"
                  maxLength={120}
                />
              </Field>
              <Field label="Company size">
                <select value={form.company_size} onChange={set("company_size")}>
                  <option value="">Choose a size</option>
                  {SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size} people
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Location">
                <input
                  type="text"
                  value={form.location}
                  onChange={set("location")}
                  placeholder="City, country or Remote"
                  maxLength={160}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="About the company" subtitle="What you build and how you work.">
            <Field
              label="Company description"
              hint={`${form.description.length}/5000 characters`}
            >
              <textarea
                rows={7}
                value={form.description}
                onChange={set("description")}
                maxLength={5000}
                placeholder="What does your company build? Who do you serve? What is it like to work there?"
              />
            </Field>
          </SectionCard>

          <div className="form-submit-row">
            <span className="muted">
              {company
                ? `Last updated ${formatDate(company.updated_at)}`
                : "You must create a company profile before posting a job."}
            </span>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : company ? "Save changes" : "Create company profile"}
            </button>
          </div>
        </form>

        <aside className="profile-side">
          {company ? (
            <section className="company-mini company-mini-stacked">
              <span className="company-mark company-mark-md">
                {company.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{company.name}</strong>
                <span>
                  {company.industry || "Industry not set"} ·{" "}
                  {company.company_size || "Size not set"}
                </span>
                <span>
                  {company.location || "Location not set"} · {company.jobs_count || 0} jobs
                </span>
              </div>
            </section>
          ) : (
            <section className="side-tip">
              <span className="side-tip-icon">
                <Icon name="sparkles" size={18} />
              </span>
              <div>
                <strong>Why this matters</strong>
                <p>
                  Candidates are more likely to apply when they know who is hiring and what the
                  team stands for.
                </p>
              </div>
            </section>
          )}

          <section className="side-tip">
            <span className="side-tip-icon">
              <Icon name="shield" size={18} />
            </span>
            <div>
              <strong>One company per recruiter</strong>
              <p>
                Each recruiter account owns exactly one company profile. Update this one instead of
                creating duplicates.
              </p>
            </div>
          </section>

          <section className="side-tip">
            <span className="side-tip-icon">
              <Icon name="briefcase" size={18} />
            </span>
            <div>
              <strong>Ready to hire?</strong>
              <p>Once your profile exists you can publish roles right away.</p>
              <a href="/recruiter/jobs/new" className="link-arrow">
                Post a job <Icon name="arrowRight" size={14} />
              </a>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
