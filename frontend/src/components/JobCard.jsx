import { Link } from "react-router-dom";
import { deadlineLabel, formatSalary, initials, titleCase } from "../format";
import Icon from "./Icons";

export default function JobCard({ job, compact = false }) {
  return (
    <article className={`job-card ${compact ? "job-card-compact" : ""}`}>
      <div className="job-card-top">
        <span className="company-mark">{initials(job.company?.name || job.company_name)}</span>
        <div className="job-card-heading">
          <Link to={`/jobs/${job.id}`} className="job-title">
            {job.title}
          </Link>
          <span className="job-company">{job.company?.name || job.company_name}</span>
        </div>
        {!job.is_accepting_applications && job.status ? (
          <span className="job-flag">{titleCase(job.status)}</span>
        ) : null}
      </div>

      <div className="job-meta">
        <span>
          <Icon name="pin" size={15} />
          {job.location}
        </span>
        <span>
          <Icon name="briefcase" size={15} />
          {titleCase(job.employment_type)}
        </span>
        <span>
          <Icon name="clock" size={15} />
          {deadlineLabel(job.deadline)}
        </span>
      </div>

      {!compact && job.description ? (
        <p className="job-snippet">{job.description}</p>
      ) : null}

      <div className="job-card-footer">
        <div className="job-salary">
          <strong>{formatSalary(job.salary_min, job.salary_max)}</strong>
          <span>per year</span>
        </div>
        {job.skills_required?.length ? (
          <div className="tag-row">
            {job.skills_required.slice(0, compact ? 2 : 3).map((skill) => (
              <span className="tag" key={skill}>
                {skill}
              </span>
            ))}
            {job.skills_required.length > (compact ? 2 : 3) ? (
              <span className="tag tag-more">+{job.skills_required.length - (compact ? 2 : 3)}</span>
            ) : null}
          </div>
        ) : null}
        <Link className="job-link" to={`/jobs/${job.id}`} aria-label={`View ${job.title}`}>
          View role
          <Icon name="arrowRight" size={16} />
        </Link>
      </div>
    </article>
  );
}
