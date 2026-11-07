import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import Icon from "../components/Icons";
import {
  ErrorBanner,
  Field,
  Loading,
  PageHeader,
  SectionCard,
} from "../components/ui";
import { useToast } from "../components/Toast";
import { errorMessage, formatDate } from "../format";
import { useMeta } from "../useMeta";

const EMPTY_EDUCATION = {
  institution: "",
  degree: "",
  field_of_study: "",
  start_year: "",
  end_year: "",
};

const EMPTY_EXPERIENCE = {
  company: "",
  title: "",
  start_date: "",
  end_date: "",
  description: "",
};

function toForm(profile) {
  return {
    headline: profile.headline || "",
    summary: profile.summary || "",
    phone: profile.phone || "",
    location: profile.location || "",
    linkedin_url: profile.linkedin_url || "",
    portfolio_url: profile.portfolio_url || "",
    skillsText: (profile.skills || []).join(", "),
    education: (profile.education || []).map((item) => ({
      institution: item.institution || "",
      degree: item.degree || "",
      field_of_study: item.field_of_study || "",
      start_year: item.start_year ?? "",
      end_year: item.end_year ?? "",
    })),
    experience: (profile.experience || []).map((item) => ({
      company: item.company || "",
      title: item.title || "",
      start_date: item.start_date || "",
      end_date: item.end_date || "",
      description: item.description || "",
    })),
  };
}

export default function CandidateProfile() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const meta = useMeta();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const fileInput = useRef(null);

  useEffect(() => {
    let active = true;
    api
      .get("/candidate/profile")
      .then((data) => {
        if (!active) return;
        setProfile(data);
        setForm(toForm(data));
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

  const skillsPreview = useMemo(() => {
    if (!form) return [];
    const seen = new Set();
    return form.skillsText
      .split(",")
      .map((skill) => skill.trim())
      .filter((skill) => {
        if (!skill || seen.has(skill.toLowerCase())) return false;
        seen.add(skill.toLowerCase());
        return true;
      });
  }, [form?.skillsText]);

  const set = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateEducation = (index, field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      education: prev.education.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const updateExperience = (index, field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      experience: prev.experience.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        headline: form.headline.trim() || null,
        summary: form.summary.trim() || null,
        phone: form.phone.trim() || null,
        location: form.location.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        portfolio_url: form.portfolio_url.trim() || null,
        skills: form.skillsText
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        education: form.education
          .filter((item) => item.institution.trim() && item.degree.trim())
          .map((item) => ({
            institution: item.institution.trim(),
            degree: item.degree.trim(),
            field_of_study: item.field_of_study.trim() || null,
            start_year: item.start_year ? Number(item.start_year) : null,
            end_year: item.end_year ? Number(item.end_year) : null,
          })),
        experience: form.experience
          .filter((item) => item.company.trim() && item.title.trim())
          .map((item) => ({
            company: item.company.trim(),
            title: item.title.trim(),
            start_date: item.start_date.trim() || null,
            end_date: item.end_date.trim() || null,
            description: item.description.trim() || null,
          })),
      };
      const updated = await api.put("/candidate/profile", payload);
      setProfile(updated);
      setForm(toForm(updated));
      showToast("Profile saved. Recruiters will see the latest version.", "success");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadResume = async () => {
    if (!resumeFile) return;
    setUploading(true);
    setError("");
    const body = new FormData();
    body.append("file", resumeFile);
    try {
      const updated = await api.post("/candidate/resume", body);
      setProfile(updated);
      setResumeFile(null);
      if (fileInput.current) fileInput.current.value = "";
      showToast("Resume uploaded.", "success");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const deleteResume = async () => {
    if (!window.confirm("Remove your resume from your profile?")) return;
    setError("");
    try {
      const updated = await api.delete("/candidate/resume");
      setProfile(updated);
      showToast("Resume removed.", "success");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (loading || !form) {
    return (
      <div className="container page">
        <Loading label="Loading your profile…" />
      </div>
    );
  }

  return (
    <div className="container page">
      <PageHeader
        eyebrow="Candidate profile"
        title="The you that recruiters meet first."
        description="A clear, specific profile gives hiring teams the context to say yes."
        actions={
          <>
            <a href={`mailto:${user.email}`} className="btn btn-ghost">
              <Icon name="mail" size={16} /> {user.email}
            </a>
            <button type="submit" form="profile-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </>
        }
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      <div className="profile-layout">
        <form id="profile-form" className="profile-main" onSubmit={save}>
          <SectionCard title="Basics" subtitle="Who you are and where you work from.">
            <div className="form-grid-two">
              <Field label="Headline" hint="A short, specific line about your work">
                <input
                  type="text"
                  value={form.headline}
                  onChange={set("headline")}
                  maxLength={160}
                  placeholder="Senior frontend engineer · design systems"
                />
              </Field>
              <Field label="Location">
                <input
                  type="text"
                  value={form.location}
                  onChange={set("location")}
                  maxLength={160}
                  placeholder="City, country or Remote"
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={set("phone")}
                  maxLength={40}
                  placeholder="+1 555 0100"
                />
              </Field>
              <Field label="LinkedIn">
                <input
                  type="url"
                  value={form.linkedin_url}
                  onChange={set("linkedin_url")}
                  maxLength={255}
                  placeholder="https://linkedin.com/in/you"
                />
              </Field>
              <Field label="Portfolio or website" className="span-2">
                <input
                  type="url"
                  value={form.portfolio_url}
                  onChange={set("portfolio_url")}
                  maxLength={255}
                  placeholder="https://your-work.example.com"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="About you" subtitle="The two-minute version of your story.">
            <Field label="Professional summary" hint={`${form.summary.length}/5000 characters`}>
              <textarea
                rows={6}
                value={form.summary}
                onChange={set("summary")}
                maxLength={5000}
                placeholder="What do you do, what are you good at, and what kind of team do you want to join?"
              />
            </Field>
          </SectionCard>

          <SectionCard title="Skills" subtitle="Comma-separated. Keep them specific and honest.">
            <Field label="Skills" hint="Examples: React, TypeScript, user research, SQL">
              <input
                type="text"
                value={form.skillsText}
                onChange={set("skillsText")}
                placeholder="Skill one, skill two, skill three"
              />
            </Field>
            {skillsPreview.length ? (
              <div className="tag-row tag-row-lg">
                {skillsPreview.map((skill) => (
                  <span className="tag tag-large" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Experience"
            subtitle="Roles that shaped how you work."
            action={
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() =>
                  setForm((prev) => ({ ...prev, experience: [...prev.experience, { ...EMPTY_EXPERIENCE }] }))
                }
              >
                <Icon name="plus" size={15} /> Add role
              </button>
            }
          >
            {form.experience.length ? (
              <div className="repeater">
                {form.experience.map((item, index) => (
                  <div className="repeater-card" key={index}>
                    <div className="repeater-head">
                      <span className="repeater-index">{String(index + 1).padStart(2, "0")}</span>
                      <strong>{item.title || item.company || "New role"}</strong>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            experience: prev.experience.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                        aria-label="Remove experience"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                    <div className="form-grid-two">
                      <Field label="Company">
                        <input type="text" value={item.company} onChange={updateExperience(index, "company")} maxLength={160} />
                      </Field>
                      <Field label="Job title">
                        <input type="text" value={item.title} onChange={updateExperience(index, "title")} maxLength={160} />
                      </Field>
                      <Field label="Start">
                        <input type="text" value={item.start_date} onChange={updateExperience(index, "start_date")} placeholder="2022" maxLength={30} />
                      </Field>
                      <Field label="End">
                        <input type="text" value={item.end_date} onChange={updateExperience(index, "end_date")} placeholder="Present" maxLength={30} />
                      </Field>
                      <Field label="What you did" className="span-2">
                        <textarea
                          rows={3}
                          value={item.description}
                          onChange={updateExperience(index, "description")}
                          maxLength={2000}
                          placeholder="One or two specific outcomes matter more than a list of duties."
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No roles added yet. Add one so recruiters can see your experience.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Education"
            subtitle="Where you studied or trained."
            action={
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() =>
                  setForm((prev) => ({ ...prev, education: [...prev.education, { ...EMPTY_EDUCATION }] }))
                }
              >
                <Icon name="plus" size={15} /> Add education
              </button>
            }
          >
            {form.education.length ? (
              <div className="repeater">
                {form.education.map((item, index) => (
                  <div className="repeater-card" key={index}>
                    <div className="repeater-head">
                      <span className="repeater-index">{String(index + 1).padStart(2, "0")}</span>
                      <strong>{item.degree || item.institution || "New education"}</strong>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            education: prev.education.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                        aria-label="Remove education"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                    <div className="form-grid-two">
                      <Field label="Institution">
                        <input type="text" value={item.institution} onChange={updateEducation(index, "institution")} maxLength={160} />
                      </Field>
                      <Field label="Degree">
                        <input type="text" value={item.degree} onChange={updateEducation(index, "degree")} maxLength={160} />
                      </Field>
                      <Field label="Field of study">
                        <input type="text" value={item.field_of_study} onChange={updateEducation(index, "field_of_study")} maxLength={160} />
                      </Field>
                      <div className="form-grid-two nested">
                        <Field label="Start year">
                          <input type="number" min="1950" max="2100" value={item.start_year} onChange={updateEducation(index, "start_year")} />
                        </Field>
                        <Field label="End year">
                          <input type="number" min="1950" max="2100" value={item.end_year} onChange={updateEducation(index, "end_year")} />
                        </Field>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No education added yet.</p>
            )}
          </SectionCard>

          <div className="form-submit-row">
            <span className="muted">Your changes are saved when you press Save profile.</span>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>

        <aside className="profile-side">
          <section className="resume-card">
            <div className="resume-head">
              <span className="resume-icon">
                <Icon name="file" size={22} />
              </span>
              <div>
                <h2>Resume</h2>
                <p>PDF, DOC or DOCX · max {meta.limits?.resume_max_size_mb || 5} MB</p>
              </div>
            </div>

            {profile.has_resume ? (
              <div className="resume-current">
                <span className="resume-file-icon">
                  <Icon name="file" size={18} />
                </span>
                <div>
                  <strong>{profile.resume_filename}</strong>
                  <small>Uploaded {formatDate(profile.resume_uploaded_at)}</small>
                </div>
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={deleteResume}
                  aria-label="Delete resume"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ) : (
              <p className="muted">
                No resume yet. Recruiters can see your profile, but a resume makes the strongest
                first impression.
              </p>
            )}

            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.doc,.docx"
              className="file-input"
              id="resume-upload"
              onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
            />
            <label htmlFor="resume-upload" className="file-drop">
              <Icon name="upload" size={19} />
              <span>{resumeFile ? resumeFile.name : "Choose a file to upload"}</span>
            </label>
            <button
              type="button"
              className="btn btn-secondary btn-full"
              onClick={uploadResume}
              disabled={!resumeFile || uploading}
            >
              {uploading ? "Uploading…" : profile.has_resume ? "Replace resume" : "Upload resume"}
            </button>
          </section>

          <section className="side-tip">
            <span className="side-tip-icon">
              <Icon name="sparkles" size={18} />
            </span>
            <div>
              <strong>Profile notes that work</strong>
              <ul className="tips-list">
                <li>Lead with outcomes, not responsibilities.</li>
                <li>Use the same skill words as the roles you want.</li>
                <li>Keep your headline specific to your strongest work.</li>
              </ul>
            </div>
          </section>

          <section className="profile-identity">
            <span className="avatar avatar-lg">{user.full_name.slice(0, 1)}</span>
            <div>
              <strong>{user.full_name}</strong>
              <span>{user.email}</span>
              <small>Account since {formatDate(user.created_at)}</small>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
