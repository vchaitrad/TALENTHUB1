# TalentHub — Business Rules

This is the complete catalogue of business rules enforced by the TalentHub backend.

- **Single source of truth:** every rule is a plain function in
  [`backend/app/services/rules.py`](backend/app/services/rules.py).
- **Configurable values** (limits, deadlines, status machines, upload policy) live in
  [`backend/app/config.py`](backend/app/config.py).
- **Thin routes:** endpoints in `backend/app/routes/` only parse input, call a service, and return
  a schema. Services load rows and call the rules below. Routes contain no rule decisions.
- **Consistent errors:** a violation raises `RuleViolation`, which
  [`backend/app/main.py`](backend/app/main.py) converts to:

  ```json
  { "detail": "Human-readable explanation.", "rule": "stable_rule_key" }
  ```

  HTTP status is **400**, **403**, or **409** depending on the rule (listed below).

> When a rule changes, update both `rules.py` (and its docstring), the configured value in
> `config.py`, and the corresponding row in this file.

---

## 1. Accounts & authentication

| Rule key | Rule | Where it lives | HTTP error |
|---|---|---|---|
| `password_policy` | A password must be between `MIN_PASSWORD_LENGTH` (8) and `MAX_PASSWORD_LENGTH` (128) characters. | `ensure_password_meets_policy()` | **400** — “Password is too short…” / “Password is too long…” |
| `password_change_differs` | A password change must use a different password from the current one. | `ensure_new_password_differs_from_current()` | **400** — “Your new password must be different from your current password.” |
| `unique_email` | An email address can belong to only one account. | `ensure_email_is_available()` | **409** — “An account with this email already exists. Please log in instead.” |
| `admin_invite_code` | Admin accounts can only be registered with the configured private invite code (`ADMIN_INVITE_CODE`). The code is never returned by the API. | `ensure_admin_invite_code_is_valid()` | **403** — “Admin registration requires a valid admin invite code…” |
| `account_active` | Only `active` accounts can log in or call authenticated endpoints. Disabled accounts are blocked until an admin re-enables them. | `ensure_user_account_is_active()` | **403** — “Your account has been disabled…” |
| `role_access` | Role-based access: the account must hold one of the roles allowed for the action (candidate, recruiter, admin). | `ensure_user_has_role()` | **403** — “Only {roles} accounts can {action}. Your account role is {role}.” |
| `cannot_delete_self` | An admin cannot delete their own account. | `ensure_user_cannot_delete_self()` | **403** — “You cannot delete your own admin account.” |
| `cannot_disable_self` | An admin cannot disable their own account. | `ensure_user_cannot_disable_self()` | **403** — “You cannot disable your own admin account.” |

Role guard wiring: `backend/app/core/deps.py` (`require_roles`, `get_current_user`).

---

## 2. Profiles & companies

| Rule key | Rule | Where it lives | HTTP error |
|---|---|---|---|
| `profile_ownership` | A candidate can edit only their own profile. Admins can edit any candidate profile. Recruiters cannot edit candidate profiles. | `ensure_profile_owner_or_admin()` | **403** — “You can only edit your own candidate profile.” |
| `company_requires_recruiter` | Only recruiter accounts can create or edit a company profile. | `ensure_recruiter_role()` | **403** — “Only recruiter accounts can manage a company profile.” |
| `company_profile_required` | A recruiter must have a company profile before publishing a job; a job without a company also cannot be published. | `ensure_company_profile_exists()`, `ensure_job_can_be_published()` | **400** — “Create your company profile before posting a job…” / “This job has no company profile and cannot be published.” |
| `one_company_per_recruiter` | Each recruiter account can own exactly one company profile; further creates must be edits. | `ensure_one_company_per_recruiter()` | **409** — “You already have a company profile. Edit the existing company…” |

---

## 3. Jobs

| Rule key | Rule | Where it lives | HTTP error |
|---|---|---|---|
| `job_salary_range` | If both salaries are supplied, `salary_min` cannot be greater than `salary_max`. | `ensure_job_salary_range()` | **400** — “Minimum salary cannot be greater than maximum salary.” |
| `job_openings` | A job must have at least 1 opening and at most `MAX_JOB_OPENINGS` (100). | `ensure_job_openings_are_valid()` | **400** — “A job must have at least 1 opening.” / “A job cannot have more than 100 openings.” |
| `job_deadline` | A published job’s deadline must be today or later. The deadline is inclusive (valid through the whole day). Drafts may store a past deadline, but cannot be published with one. | `ensure_job_deadline_is_not_in_the_past()` | **400** — “The application deadline (YYYY-MM-DD) has already passed…” |
| `job_accepting_applications` | A candidate may apply only to an **OPEN** job whose deadline has not passed. Draft, closed, and expired jobs reject applications. | `ensure_job_is_accepting_applications()` | **409** — “This job is still a draft…” / “This job is closed…” / “The application deadline for this job passed on …” |
| `job_ownership` | Only the recruiter who posted a job (or an admin) can manage it, view its applicants, change its status, or delete it. Other recruiters are denied even at the same company. | `ensure_job_owner_or_admin()` | **403** — “Only the recruiter who posted this job can view or manage its applicants.” |
| `job_editable` | Closed jobs cannot be edited by recruiters; they must be reopened first. Admins may edit any job. | `ensure_job_can_be_edited()` | **409** — “Closed jobs cannot be edited. Reopen the job before making changes.” |
| `job_initial_status` | A new job can only be created as `draft` or immediately published as `open`; it cannot start `closed`. | `ensure_job_initial_status_allowed()` | **400** — “A new job can only be saved as a draft or published as open.” |
| `job_status_transition` | Job statuses may only follow the configured state machine (see below). No-op changes are rejected too. | `ensure_job_status_transition_allowed()` | **409** — “Invalid job status change: open → draft. Allowed next statuses: closed.” / “This job is already open.” |
| `company_profile_required` (publish) | A job can only be opened if it has a company and a non-past deadline. Admin reopens follow the same check. | `ensure_job_can_be_published()` | **400** — deadline message or “This job has no company profile and cannot be published.” |

### Job status machine

Configured in `JOB_STATUS_TRANSITIONS` inside `backend/app/config.py`.

```
DRAFT ──► OPEN
  │        │
  ▼        ▼
CLOSED ◄───┘
  │
  └──► OPEN   (reopen only while the deadline is not past)
```

- `draft → open`, `draft → closed`
- `open → closed`
- `closed → open`
- Everything else is rejected with **409**.

---

## 4. Applications & status transitions

| Rule key | Rule | Where it lives | HTTP error |
|---|---|---|---|
| `duplicate_application` | A candidate may apply only once to a given job. The check covers every status, including withdrawn applications, so withdrawing does not allow re-applying. A database-level unique constraint backs this up. | `ensure_candidate_has_not_applied()` | **409** — “You have already applied to this job. Each candidate may apply only once per job.” |
| `application_status_transition` | Applications move only through the configured pipeline. Hired, rejected, and withdrawn are terminal. No-op changes are rejected. | `ensure_application_status_transition_allowed()` | **409** — “Invalid application status change: offered → shortlisted. Allowed next statuses: hired, rejected.” |
| `application_withdrawable` | A candidate can withdraw only before an offer, while the application is `applied` or `shortlisted`. | `ensure_application_can_be_withdrawn()` | **409** — “An application in the interview stage cannot be withdrawn. Withdrawal is only allowed while the status is: applied, shortlisted.” |
| `application_ownership` | Only the candidate who owns an application (or an admin) may act on it / withdraw it. | `ensure_application_owner_or_admin()` | **403** — “You can only view or withdraw your own applications.” |
| `applicant_management` | Only the job’s recruiter (or an admin) may list applicants and change application statuses. | `ensure_can_manage_job_applications()` | **403** — “Only the recruiter who posted this job can view applicants or change their application status.” |
| `application_visibility` | An application is visible only to its candidate, the recruiter who posted that job, or an admin. | `ensure_can_view_application()` | **403** — “You do not have permission to view this application.” |

### Application status machine

Configured in `APPLICATION_STATUS_TRANSITIONS` and `CANDIDATE_WITHDRAWABLE_STATUSES`
inside `backend/app/config.py`.

```
APPLIED ──► SHORTLISTED ──► INTERVIEW ──► OFFERED ──► HIRED
   │             │              │            │
   ├──► REJECTED ├──► REJECTED  ├──► REJECTED├──► REJECTED
   │             │
   └──► WITHDRAWN└──► WITHDRAWN
```

- `applied → shortlisted | rejected | withdrawn`
- `shortlisted → interview | rejected | withdrawn`
- `interview → offered | rejected`
- `offered → hired | rejected`
- `hired`, `rejected`, `withdrawn` → **no further transitions**
- Withdrawal by a candidate is allowed only from `applied` or `shortlisted`.
- Recruiters can reject from `applied`, `shortlisted`, `interview`, and `offered`.
- Status history is appended on every transition (`ApplicationStatusHistory`).

---

## 5. Resumes

| Rule key | Rule | Where it lives | HTTP error |
|---|---|---|---|
| `resume_file` | A resume must be non-empty, have an allowed extension (`pdf, doc, docx`), an allowed content type, and be no larger than `MAX_RESUME_SIZE_MB` (5 MB). | `ensure_resume_file_is_valid()` | **400** — “Choose a resume file…” / “Invalid resume type. Allowed file types: doc, docx, pdf.” / “Invalid resume content type…” / “The resume file is empty…” / “Resume is too large. The maximum size is 5 MB.” |
| `resume_exists` | A resume must exist before it can be downloaded or deleted. | `ensure_resume_uploaded()` | **400** — “No resume has been uploaded to this profile yet.” |
| `resume_access` | Resumes are private: visible to the owning candidate, admins, or a recruiter with a relationship (the candidate applied to one of that recruiter’s jobs). | `ensure_can_view_resume()` | **403** — “You do not have permission to download this resume…” |

Upload policy values live in `backend/app/config.py`: `ALLOWED_RESUME_EXTENSIONS`,
`ALLOWED_RESUME_CONTENT_TYPES`, `MAX_RESUME_SIZE_MB`.

---

## 6. Where each rule is enforced

| Area | Route file | Service file | Rules called |
|---|---|---|---|
| Registration/login/account | `routes/auth.py` | `services/auth_service.py` | password, unique email, admin invite, account active |
| Roles on every protected endpoint | `core/deps.py` | — | `role_access`, `account_active` |
| Candidate profile & resume | `routes/candidate.py` | `services/candidate_service.py` | profile ownership, resume file/existence/access |
| Company profile | `routes/recruiter.py` | `services/company_service.py` | recruiter role, one company per recruiter |
| Job posting/lifecycle | `routes/jobs.py`, `routes/recruiter.py`, `routes/admin.py` | `services/job_service.py` | salary, openings, deadline, ownership, editable, initial status, status transition, publish |
| Applying | `routes/applications.py` | `services/application_service.py` | job accepting, duplicate application |
| Applicant review/status | `routes/recruiter.py`, `routes/admin.py` | `services/application_service.py` | applicant management, application transitions, visibility |
| Withdrawals | `routes/applications.py` | `services/application_service.py` | ownership, withdrawable, transition |
| Admin user/job/application management | `routes/admin.py` | `services/stats_service.py`, `services/job_service.py`, `services/application_service.py` | role access, self-delete/self-disable, ownership, transitions |

---

## 7. Adding a new rule

1. Add the function to `backend/app/services/rules.py` with a plain-English docstring.
2. Add any tunable value (limit, threshold, status set, deadline policy) to `backend/app/config.py`.
3. Call the rule from the relevant service (never from a route).
4. Add a row to this file with the rule key, description, function, and HTTP error.
5. Add a check to `backend/smoke_test.py` so the rule is verified end to end.

**Test evidence:** `backend/smoke_test.py` exercises all major rules and reports
`All 49 smoke checks passed.` (last verified run: 49/49).
