# TalentHub

A complete, working role-based hiring platform: candidates build profiles and apply to jobs,
recruiters post jobs and manage applicants, and admins manage the platform.

- **Backend:** Python 3.11+ · FastAPI · SQLAlchemy 2 · SQLite (PostgreSQL-ready) · JWT auth
- **Frontend:** React 18 · Vite 6 · React Router
- **Docs:** OpenAPI / Swagger at `http://127.0.0.1:8000/docs`
- **Business rules:** every rule is in one file, catalogued in [`RULES.md`](RULES.md)

---

## Quick start (Windows + VS Code)

### 1. Open the project

In VS Code: **File → Open Folder… → `TALENTHUB1`**.

Open two terminals (**Terminal → New Terminal**) and use PowerShell for both.

### 2. Backend — first time only

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

> If PowerShell blocks activation, run this once in the same window:
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

### 3. Seed demo data

```powershell
python -m app.seed --reset
```

Expected output ends with the demo accounts:

```
TalentHub demo data created successfully.
Candidate : candidate@example.com / Candidate123!
Recruiter : recruiter@technova.com / Recruiter123!
Admin     : admin@talenthub.dev / Admin123!
```

### 4. Run the backend

```powershell
uvicorn app.main:app --reload --port 8000
```

- API: <http://127.0.0.1:8000>
- Health: <http://127.0.0.1:8000/api/health>
- Swagger docs: <http://127.0.0.1:8000/docs>

Leave this terminal running.

### 5. Frontend — in the second terminal

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to `http://127.0.0.1:8000`, so no frontend
environment variable is required for local development. If port 8000 is already taken, set
`VITE_API_PROXY_TARGET` in the second terminal before `npm run dev`, for example
`$env:VITE_API_PROXY_TARGET = "http://127.0.0.1:8010"` (PowerShell).

### 6. Log in with a demo account

| Role | Email | Password |
|---|---|---|
| Candidate | `candidate@example.com` | `Candidate123!` |
| Candidate | `priya@example.com` | `Candidate123!` |
| Recruiter | `recruiter@technova.com` | `Recruiter123!` |
| Recruiter | `recruiter@brightworks.com` | `Recruiter123!` |
| Admin | `admin@talenthub.dev` | `Admin123!` |

Additional seeded candidates: `marcus@example.com`, `lena@example.com` (same password).
To register an admin yourself, use the invite code from `backend/.env`
(default: `TALENTHUB-ADMIN-2026`).

---

## What each role can do

### Candidate
- Register / log in
- Edit profile: headline, summary, contact, links, skills, education, experience
- Upload / replace / delete a resume (PDF, DOC, DOCX; max 5 MB)
- Browse, search, filter, sort and paginate open jobs
- Apply once per job with an optional cover note
- Track every application, view its status timeline, withdraw before an offer
- Dashboard with pipeline counts and profile-completion meter

### Recruiter
- Register / log in
- Create and edit exactly one company profile
- Create jobs as draft or open; edit open jobs; close, reopen, delete
- View applicants for their own jobs only, with full candidate profiles and resume download
- Move applications forward through the hiring pipeline with an optional note
- Dashboard with job, applicant and interview counts

### Admin
- Dashboard with platform-wide statistics and breakdowns
- Search/filter users; view candidate profiles; activate/disable/delete accounts
- Manage all jobs: filter, search, publish/close/reopen, delete
- Review all applications, inspect timelines, correct a stage if needed
- Admins cannot disable or delete their own account

---

## Project structure

```
TALENTHUB1/
├── README.md
├── RULES.md                       ← every business rule, code location and error
├── .gitignore
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── smoke_test.py              ← 49 end-to-end rule checks
│   ├── talenthub.db               ← created/refreshed by the seed script
│   ├── uploads/resumes/           ← private resume storage
│   └── app/
│       ├── main.py                ← FastAPI app, CORS, exception handlers, routers
│       ├── config.py              ← ALL tunable values + status machines
│       ├── database.py            ← engine, session, Base, SQLite FK pragma
│       ├── seed.py                ← sample users, companies, jobs, applications
│       ├── core/
│       │   ├── security.py        ← password hashing + JWT creation/decoding
│       │   ├── deps.py            ← current user, role guards
│       │   └── errors.py          ← RuleViolation + get_or_404
│       ├── models/                ← User, CandidateProfile, Company, Job, Application, history
│       ├── schemas/               ← Pydantic request/response models
│       ├── routes/                ← thin endpoints
│       │   ├── auth.py  jobs.py  applications.py  candidate.py
│       │   ├── recruiter.py  admin.py  files.py  meta.py
│       └── services/
│           ├── rules.py           ← ⭐ all business rules, one function per rule
│           ├── auth_service.py  candidate_service.py  company_service.py
│           ├── job_service.py  application_service.py  stats_service.py
│           └── mappers.py
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx  App.jsx  index.css
        ├── api.js                 ← fetch wrapper, JWT header, API errors
        ├── meta.js / useMeta.js   ← statuses + valid transitions from the API
        ├── auth/AuthContext.jsx
        ├── components/            ← layout, modal, toast, badges, UI primitives
        └── pages/                 ← public, candidate, recruiter and admin screens
```

---

## How a request flows

Example: a recruiter moves applicant #12 to “interview”.

```
Browser (RecruiterApplicants.jsx)
   │  PATCH /api/recruiter/applications/12/status  {status:"interview", note:"..."}
   ▼
Route      backend/app/routes/recruiter.py
   │  - parses/validates the JWT and Pydantic body
   │  - calls a service; contains NO business decisions
   ▼
Service    backend/app/services/application_service.py
   │  - loads the application + job from SQLAlchemy
   │  - asks the rules layer for permission and validity
   ▼
Rules      backend/app/services/rules.py
   │  ensure_can_manage_job_applications(actor, job)
   │  ensure_application_status_transition_allowed(current, target)
   │  - raises RuleViolation(rule, message, status) on failure
   ▼
Database   SQLAlchemy models → SQLite
   │  - UPDATE application.status
   │  - INSERT application_status_history
   │  - COMMIT
   ▼
Response   Pydantic ApplicationOut → JSON
   │  - 200 with the updated application
   │  - rule failure → {"detail": "...", "rule": "..."} with 400/403/409
   ▼
Browser    updates the card / shows a toast or the exact rule message
```

Other paths follow the same shape:

| Path | Route | Service | Key rules |
|---|---|---|---|
| Apply to a job | `POST /api/jobs/{id}/applications` | `application_service.apply_to_job` | job accepting, duplicate application |
| Post a job | `POST /api/recruiter/jobs` | `job_service.create_job` | recruiter role, company required, salary, openings, deadline |
| Upload resume | `PUT /api/candidate/resume` | `candidate_service` | resume file policy |
| Admin disables a user | `PATCH /api/admin/users/{id}/status` | `stats_service.update_user_status` | self-disable, role access |
| Download a resume | `GET /api/files/resumes/{profile_id}` | `candidate_service` + files route | resume access |

---

## Business rules

All rules live in **`backend/app/services/rules.py`** as plain functions with docstrings.
All tunable values live in **`backend/app/config.py`**. Routes stay thin.

Every failure returns a consistent, human-readable payload:

```json
{
  "detail": "Invalid application status change: offered → shortlisted. Allowed next statuses: hired, rejected.",
  "rule": "application_status_transition"
}
```

Statuses are enums and transitions are enforced in one place:

- **Application:** `applied → shortlisted → interview → offered → hired`
  (rejection from active stages; withdrawal only from applied/shortlisted; hired/rejected/withdrawn terminal)
- **Job:** `draft → open → closed`, `closed → open`, `draft → closed`
  (reopening requires a non-past deadline)

See [`RULES.md`](RULES.md) for the full table of **29 rule functions**, their code locations,
HTTP statuses and exact error messages.

---

## Configuration

Copy `backend/.env.example` to `backend/.env` and adjust as needed.

| Variable | Default | Purpose |
|---|---|---|
| `SECRET_KEY` | dev placeholder | JWT signing key — **change before sharing/deploying** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token lifetime (1 day) |
| `DATABASE_URL` | `sqlite:///talenthub.db` | SQLAlchemy database URL |
| `ADMIN_INVITE_CODE` | `TALENTHUB-ADMIN-2026` | Required to register an admin |
| `MIN_PASSWORD_LENGTH` | `8` | Password policy |
| `MAX_RESUME_SIZE_MB` | `5` | Resume upload limit |
| `ALLOWED_RESUME_EXTENSIONS` | `pdf,doc,docx` | Accepted resume types |
| `CORS_ORIGINS` | localhost:5173/3000 | Allowed frontend origins |

Generate a proper secret with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

### Switching to PostgreSQL

SQLAlchemy makes this a configuration change, not a code change:

1. `pip install psycopg[binary]`
2. In `backend/.env`:
   ```env
   DATABASE_URL=postgresql+psycopg://talenthub:password@localhost:5432/talenthub
   ```
3. Re-run `python -m app.seed --reset` (or use Alembic migrations in production).

The SQLite foreign-key pragma is applied only for SQLite URLs, so it is ignored on PostgreSQL.

---

## Testing

The backend includes a self-contained smoke test that starts the real app against a temporary
SQLite database and exercises authentication, ownership, transitions, uploads, admin actions,
and the OpenAPI schema.

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python smoke_test.py
```

Expected final line:

```
All 49 smoke checks passed.
```

Frontend production build check:

```powershell
cd frontend
npm run build
```

---

## API overview

Base URL: `http://127.0.0.1:8000/api` · interactive docs: `/docs`

| Area | Examples |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/token`, `GET /auth/me`, `POST /auth/change-password` |
| Public jobs | `GET /jobs`, `GET /jobs/{id}` |
| Candidate | `GET/PUT /candidate/profile`, `POST/DELETE /candidate/resume`, `GET /candidate/summary`, `GET /candidate/applications` |
| Applications | `POST /jobs/{id}/applications`, `GET /applications/{id}`, `POST /applications/{id}/withdraw` |
| Recruiter | `GET/PUT /recruiter/company`, `GET/POST /recruiter/jobs`, `PUT/DELETE /recruiter/jobs/{id}`, `PATCH /recruiter/jobs/{id}/status`, `GET /recruiter/jobs/{id}/applications`, `PATCH /recruiter/applications/{id}/status` |
| Admin | `GET /admin/stats`, `GET /admin/users`, `PATCH /admin/users/{id}/status`, `DELETE /admin/users/{id}`, `GET /admin/jobs`, `PATCH /admin/jobs/{id}/status`, `GET /admin/applications`, `PATCH /admin/applications/{id}/status` |
| Files | `GET /files/resumes/{profile_id}` (private, permission-checked) |
| Meta | `GET /meta/options` (statuses, transitions, limits for the UI) |

JWT: send `Authorization: Bearer <access_token>`. In Swagger, use **Authorize** with the
email/password form (`/auth/token`).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Activate.ps1 cannot be loaded` | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` |
| Frontend says “Cannot reach the TalentHub API” | Start the backend on port 8000; check the Vite proxy in `frontend/vite.config.js` |
| `no such table` / empty demo | Run `python -m app.seed --reset` from `backend/` |
| Login fails after seeding | Ensure you ran the seed from `backend/`, and that `DATABASE_URL` in `.env` points at the intended SQLite file |
| Port already in use | `uvicorn app.main:app --reload --port 8001` and update the Vite proxy target |
| 401 on every request | Token expired (1 day) or `SECRET_KEY` changed — log in again |
| Resume upload rejected | Use PDF/DOC/DOCX under 5 MB |

---

## Notes for evaluation

- Every rule is enforced **server-side**; the UI only hides invalid transitions for convenience.
- The unique `(job_id, candidate_id)` constraint prevents duplicate applications even under a race.
- Rule errors include a stable `rule` key plus a readable `detail`, so evaluators can assert on
  either the HTTP status/message or the key.
- `backend/smoke_test.py` is the fastest way to verify the logic end to end.
