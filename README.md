# TalentHub

![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.x-D71F00)

A role-based placement management platform that connects **candidates**, **recruiters**, and **administrators**.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Key Features](#key-features)
3. [Technology Stack](#technology-stack)
4. [System Architecture](#system-architecture)
5. [Project Folder Structure](#project-folder-structure)
6. [Prerequisites](#prerequisites)
7. [Installation and Setup (Windows / PowerShell)](#installation-and-setup-windows--powershell)
8. [Environment Variables](#environment-variables)
9. [Database Setup and Initialization](#database-setup-and-initialization)
10. [How to Run the Application](#how-to-run-the-application)
11. [API Documentation](#api-documentation)
12. [Authentication and Authorization](#authentication-and-authorization)
13. [Business Rules and Testing](#business-rules-and-testing)
14. [Screenshots](#screenshots)
15. [Future Enhancements](#future-enhancements)
16. [Security Considerations](#security-considerations)
17. [Troubleshooting](#troubleshooting)
18. [Contribution Guidelines](#contribution-guidelines)
---

## Project Overview

TalentHub lets three types of users work in one system:

- **Candidates** build a profile, upload a resume, search open jobs, apply, and track their applications.
- **Recruiters** create a company profile, post jobs, review applicants, and move them through a hiring pipeline.
- **Administrators** oversee all users, jobs, and applications on the platform.

The backend is a REST API built with FastAPI. The frontend is a React single-page application built with Vite. Data is stored in SQLite through SQLAlchemy, and the database connection is a single configurable URL so it can be pointed at PostgreSQL later (see [Database Setup](#database-setup-and-initialization)).

---

## Key Features

### Candidate

- Register and log in; change password.
- Edit a profile: headline, summary, phone, location, LinkedIn and portfolio links, skills, education, and experience.
- Upload, replace, and delete a resume (PDF, DOC, or DOCX, up to 5 MB by default).
- Browse open jobs with search, filters (location, employment type, company, skills, minimum salary), sorting (newest, deadline, salary), and pagination.
- Apply to a job (once per job) and view job details.
- Track all applications with their status history, and withdraw an application while it is still in the `applied` or `shortlisted` stage.
- Dashboard with application summary and profile-completion meter.

### Recruiter

- Register and log in; change password.
- Create and edit one company profile.
- Create jobs as a draft or publish them as open; edit, close, reopen, and delete jobs.
- View applicants for their own jobs, including candidate profiles and resume downloads.
- Move applications through the hiring pipeline (`applied` → `shortlisted` → `interview` → `offered` → `hired`, or `rejected`).
- Dashboard with a recruiter summary.

### Admin

- Dashboard with platform-wide statistics (users by role, jobs by status, applications by status).
- Search and filter users; activate, disable, or delete accounts (an admin cannot disable or delete their own account).
- View and edit any candidate profile.
- Manage all jobs: list, publish, close, reopen, and delete.
- Review all applications and change any application's status.
- Admin accounts can only be registered with a private invite code.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Backend language | Python 3.11+ |
| Backend framework | FastAPI, served with Uvicorn |
| Data validation / settings | Pydantic 2, pydantic-settings |
| ORM | SQLAlchemy 2 |
| Database | SQLite (default); PostgreSQL by changing `DATABASE_URL` |
| Authentication | JWT (PyJWT, HS256), PBKDF2-HMAC-SHA256 password hashing |
| File uploads | python-multipart, files stored on local disk |
| Frontend | React 18, React Router 6 |
| Build tool | Vite 6 |
| Testing | `smoke_test.py` end-to-end script (FastAPI `TestClient`, `httpx`) |

Exact backend dependency ranges are in [`backend/requirements.txt`](backend/requirements.txt); frontend dependencies are in [`frontend/package.json`](frontend/package.json).

---

## System Architecture

```
┌────────────────────┐      HTTP / JSON       ┌──────────────────────────┐      SQLAlchemy      ┌──────────┐
│  React + Vite SPA  │ ─────────────────────► │  FastAPI backend (/api)  │ ───────────────────► │  SQLite  │
│  localhost:5173    │ ◄───────────────────── │  127.0.0.1:8000          │ ◄─────────────────── │  (file)  │
└────────────────────┘   Bearer JWT header    └──────────────────────────┘                      └──────────┘
                                                          │
                                                          └──► uploads/resumes/  (resume files on disk)
```

**Frontend.** A React single-page application. Pages are grouped by role (public, candidate, recruiter, admin) and protected routes check the signed-in user's role. All API calls go through `frontend/src/api.js`, which attaches the JWT as a `Authorization: Bearer <token>` header.

**Dev-server proxy.** During development, Vite proxies every request starting with `/api` to `http://127.0.0.1:8000` (configured in `frontend/vite.config.js`), so the browser only talks to one origin.

**Backend.** FastAPI is organized in layers:

| Layer | Location | Responsibility |
|---|---|---|
| Routes | `backend/app/routes/` | Parse requests, call a service, return a schema |
| Services | `backend/app/services/` | Load data with SQLAlchemy and apply business rules |
| Rules | `backend/app/services/rules.py` | One function per business rule |
| Schemas | `backend/app/schemas/` | Pydantic request and response models |
| Models | `backend/app/models/` | SQLAlchemy tables |
| Core | `backend/app/core/` | Password hashing, JWT, role guards, error types |
| Config | `backend/app/config.py` | Settings from `.env`, status transition tables |

**Database.** Tables are created automatically when the backend starts (`Base.metadata.create_all`). The tables are `users`, `candidate_profiles`, `companies`, `jobs`, `applications`, and `application_status_history`.

**Errors.** Business-rule violations return JSON in the form `{"detail": "...", "rule": "rule_key"}` with status 400, 403, or 409.

---

## Project Folder Structure

```
TALENTHUB1/
├── README.md
├── RULES.md                    # Catalogue of business rules
├── .gitignore
├── backend/
│   ├── .env.example            # Template for backend/.env
│   ├── requirements.txt
│   ├── smoke_test.py           # End-to-end API checks
│   ├── uploads/
│   │   └── resumes/            # Uploaded resumes (contents are git-ignored)
│   └── app/
│       ├── main.py             # FastAPI app, CORS, error handlers, routers
│       ├── config.py           # Settings and status transition tables
│       ├── database.py         # Engine, session, Base, SQLite foreign keys
│       ├── seed.py             # Demo data script
│       ├── core/               # security.py, deps.py, errors.py
│       ├── models/             # user, candidate, company, job, application, enums
│       ├── schemas/            # auth, candidate, company, job, application, common
│       ├── routes/             # auth, jobs, applications, candidate, recruiter,
│       │                       # admin, files, meta
│       └── services/           # rules, auth, candidate, company, job,
│                               # application, stats, mappers
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx, App.jsx, index.css
        ├── api.js              # fetch wrapper, token handling, API errors
        ├── meta.js, useMeta.js, format.js
        ├── auth/               # AuthContext.jsx
        ├── components/         # Layout, ProtectedRoute, Modal, Toast, JobCard, ...
        └── pages/              # Landing, Login, Register, JobSearch, JobDetail,
                                # Candidate*, Recruiter*, Admin*, Account, NotFound
```

Generated folders such as `.venv/`, `node_modules/`, and `dist/`, and the local database file `backend/talenthub.db`, are listed in `.gitignore` and are not part of the repository.

---

## Prerequisites

| Requirement | Version | Check with |
|---|---|---|
| Python | 3.11 or newer | `python --version` |
| Node.js | 18 or newer (20 LTS recommended) | `node --version` |
| npm | Installed with Node.js | `npm --version` |
| Git | Any recent version | `git --version` |

---

## Installation and Setup (Windows / PowerShell)

Run all commands in **PowerShell**. You will need two terminal windows: one for the backend and one for the frontend.

### 1. Get the code

```powershell
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

Replace the placeholders with your own GitHub username and repository name. If you already have the project folder, just open a terminal in it.

### 2. Backend setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

If PowerShell refuses to activate the virtual environment, run this once in the same window and activate again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Generate a secret key and put it in `backend/.env` as `SECRET_KEY`:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

### 3. Frontend setup

In a second terminal, from the project root:

```powershell
cd frontend
npm install
```

---

## Environment Variables

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`. All variables are optional because each has a default in `backend/app/config.py`, but you should set `SECRET_KEY` and `ADMIN_INVITE_CODE` yourself.

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `TalentHub` | Application name shown in the API docs |
| `ENVIRONMENT` | `development` | Environment label |
| `SECRET_KEY` | placeholder string | Key used to sign JWTs. **Change it.** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token lifetime (1 day) |
| `MIN_PASSWORD_LENGTH` | `8` | Minimum password length |
| `ADMIN_INVITE_CODE` | `TALENTHUB-ADMIN-2026` | Code required to register an admin account. **Change it.** |
| `DATABASE_URL` | `sqlite:///talenthub.db` | SQLAlchemy database URL (a relative SQLite path resolves inside `backend/`) |
| `SQL_ECHO` | `false` | Log SQL statements |
| `UPLOAD_DIR` | `uploads` | Upload folder (resumes go in `<UPLOAD_DIR>/resumes`) |
| `MAX_RESUME_SIZE_MB` | `5` | Maximum resume size |
| `ALLOWED_RESUME_EXTENSIONS` | `pdf,doc,docx` | Allowed resume file extensions |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000` | Comma-separated allowed browser origins |
| `PAGE_SIZE_DEFAULT` | `10` | Default page size for job listings |
| `PAGE_SIZE_MAX` | `50` | Maximum page size |

Other settings (for example `API_PREFIX`, `JWT_ALGORITHM`, `MAX_PASSWORD_LENGTH`, and job limits) exist in `config.py` and can also be overridden through environment variables, but they are not listed in `.env.example`.

### Frontend

No variables are required for local development.

| Variable | Used in | Description |
|---|---|---|
| `VITE_API_PROXY_TARGET` | `frontend/vite.config.js` | Backend URL the dev server proxies `/api` to. Default `http://127.0.0.1:8000` |
| `VITE_API_URL` | `frontend/src/api.js` | API base URL used by the browser. Default `/api` |

Example, if your backend runs on port 8010:

```powershell
$env:VITE_API_PROXY_TARGET = "http://127.0.0.1:8010"
npm run dev
```

---

## Database Setup and Initialization

**Tables are created automatically** the first time the backend starts. You do not need a separate migration step for SQLite.

### Load demo data (optional, recommended for first run)

From the `backend` folder with the virtual environment active:

```powershell
python -m app.seed --reset
```

> **Warning:** `--reset` drops all tables and rebuilds them. Without `--reset`, the script refuses to run against a non-empty database.

The seed script creates sample companies, jobs, applications, and sample resume PDFs, plus these accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@talenthub.dev` | `Admin123!` |
| Recruiter | `recruiter@technova.com` | `Recruiter123!` |
| Recruiter | `recruiter@brightworks.com` | `Recruiter123!` |
| Candidate | `candidate@example.com` | `Candidate123!` |
| Candidate | `priya@example.com` | `Candidate123!` |
| Candidate | `marcus@example.com` | `Candidate123!` |
| Candidate | `lena@example.com` | `Candidate123!` |

These are demo credentials only. Do not use the seed script or these passwords in a real deployment.

### Switching to PostgreSQL

The connection is controlled by `DATABASE_URL`, and the code does not hard-code SQLite-specific behavior (the SQLite foreign-key pragma is applied only for `sqlite` URLs). To try PostgreSQL:

```powershell
pip install "psycopg[binary]"
```

Then set in `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/talenthub
```

> The project does not include a migration tool such as Alembic, and PostgreSQL has not been tested in this repository. Tables are created with `create_all`, which does not alter existing tables.

---

## How to Run the Application

### Backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

| URL | Purpose |
|---|---|
| http://127.0.0.1:8000/ | API root |
| http://127.0.0.1:8000/api/health | Health check |
| http://127.0.0.1:8000/docs | Swagger UI |
| http://127.0.0.1:8000/redoc | ReDoc |

### Frontend

In a second terminal:

```powershell
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

### Production build of the frontend

```powershell
cd frontend
npm run build
npm run preview
```

`npm run build` writes static files to `frontend/dist/`. Serving them in production and pointing them at the API is not configured in this repository.

---

## API Documentation

FastAPI generates interactive documentation automatically. With the backend running:

- **Swagger UI:** http://127.0.0.1:8000/docs
- **ReDoc:** http://127.0.0.1:8000/redoc
- **OpenAPI schema:** http://127.0.0.1:8000/openapi.json

To try protected endpoints in Swagger UI, click **Authorize**, enter a user's **email as the username** and their password, then call endpoints as that user.

All endpoints are prefixed with `/api`. "Auth" means a valid Bearer token is required.

### Authentication

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register a candidate, recruiter, or admin (admin needs the invite code) |
| POST | `/auth/login` | Public | Log in with email and password |
| POST | `/auth/token` | Public | OAuth2 password form login (used by Swagger **Authorize**) |
| GET | `/auth/me` | Auth | Current account |
| POST | `/auth/change-password` | Auth | Change password |

### Jobs and applications

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/jobs` | Public | Browse open jobs. Query: `q`, `location`, `employment_type`, `company`, `skills`, `min_salary`, `sort` (`newest`, `deadline`, `salary`), `page`, `page_size` |
| GET | `/jobs/{job_id}` | Public (token optional) | Job details |
| POST | `/jobs/{job_id}/applications` | Candidate | Apply to a job |
| GET | `/applications/{application_id}` | Candidate (owner), job's recruiter, or admin | Application details |
| POST | `/applications/{application_id}/withdraw` | Candidate (owner) | Withdraw an application |

### Candidate

| Method | Endpoint | Description |
|---|---|---|
| GET | `/candidate/profile` | Get my profile |
| PUT | `/candidate/profile` | Update my profile |
| POST | `/candidate/resume` | Upload or replace resume |
| DELETE | `/candidate/resume` | Delete resume |
| GET | `/candidate/summary` | Dashboard summary |
| GET | `/candidate/applications` | Track my applications |
| GET | `/files/resumes/{profile_id}` | Download a resume (owner, connected recruiter, or admin) |

### Recruiter

| Method | Endpoint | Description |
|---|---|---|
| GET | `/recruiter/summary` | Dashboard summary |
| GET, PUT | `/recruiter/company` | Get, or create/update, my company profile |
| GET, POST | `/recruiter/jobs` | List my jobs, create a job |
| GET, PUT, DELETE | `/recruiter/jobs/{job_id}` | Get, edit, delete my job |
| PATCH | `/recruiter/jobs/{job_id}/status` | Publish, close, or reopen my job |
| GET | `/recruiter/jobs/{job_id}/applications` | View applicants for my job |
| PATCH | `/recruiter/applications/{application_id}/status` | Move an applicant through the pipeline |

### Admin

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/stats` | Platform statistics |
| GET | `/admin/users` | List and search users |
| PATCH | `/admin/users/{user_id}/status` | Activate or disable a user |
| DELETE | `/admin/users/{user_id}` | Delete a user |
| GET, PUT | `/admin/candidates/{user_id}/profile` | View or edit any candidate profile |
| GET | `/admin/jobs` | List all jobs |
| PATCH | `/admin/jobs/{job_id}/status` | Close, publish, or reopen any job |
| DELETE | `/admin/jobs/{job_id}` | Delete any job |
| GET | `/admin/applications` | List all applications |
| PATCH | `/admin/applications/{application_id}/status` | Change any application's status |

### Utility

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/health` | Public | Health check |
| GET | `/meta/options` | Public | Statuses, transitions, and limits used by the frontend |

---

## Authentication and Authorization

**Authentication (JWT).**

1. A user registers (`POST /api/auth/register`) or logs in (`POST /api/auth/login`).
2. The API returns an `access_token` and the user's details.
3. The client sends `Authorization: Bearer <access_token>` on every protected request.
4. The token contains the user ID (`sub`), role, issue time, and expiry. It is signed with `SECRET_KEY` (HS256) and expires after `ACCESS_TOKEN_EXPIRE_MINUTES` (default 1440 minutes).
5. On every protected request the backend loads the user from the database and rejects the request if the account no longer exists or has been disabled.

Passwords are stored as salted PBKDF2-HMAC-SHA256 hashes (260,000 iterations), never in plain text. The frontend stores the token in the browser's `localStorage` under the key `talenthub_token`.

**Authorization (role-based).** There are three roles: `candidate`, `recruiter`, and `admin`. Endpoints are guarded by role on the backend, and the frontend additionally restricts pages with a `ProtectedRoute` component.

| Capability | Candidate | Recruiter | Admin |
|---|:---:|:---:|:---:|
| Browse and search open jobs | ✅ | ✅ | ✅ |
| Edit own candidate profile and resume | ✅ | – | – |
| Edit any candidate profile | – | – | ✅ |
| Apply to jobs and withdraw applications | ✅ | – | – |
| Manage own company profile | – | ✅ | – |
| Create and manage own jobs | – | ✅ | – |
| View applicants and update status for own jobs | – | ✅ | – |
| Manage all jobs and applications | – | – | ✅ |
| Manage users and view platform statistics | – | – | ✅ |

Ownership is also enforced: a recruiter can only manage jobs they posted, a candidate can only see their own applications, and resumes can only be downloaded by the owner, an admin, or a recruiter whose job the candidate applied to.

**Admin registration** requires the `ADMIN_INVITE_CODE` from `backend/.env`.

---

## Business Rules and Testing

- Every business rule (password policy, duplicate applications, job and application status transitions, deadlines, resume validation, ownership checks, and more) is documented in [`RULES.md`](RULES.md) and implemented in `backend/app/services/rules.py`.
- Tunable values and the status transition tables are in `backend/app/config.py`.

**Status flow.**

| Entity | Allowed transitions |
|---|---|
| Job | `draft → open`, `draft → closed`, `open → closed`, `closed → open` |
| Application | `applied → shortlisted / rejected / withdrawn`; `shortlisted → interview / rejected / withdrawn`; `interview → offered / rejected`; `offered → hired / rejected`; `hired`, `rejected`, `withdrawn` are final |

**Running the smoke test.** The script uses a temporary database and upload folder, so it does not touch `talenthub.db` or your uploaded resumes.

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python smoke_test.py
```

Expected final line:

```
All 49 smoke checks passed.
```

The project has no frontend tests.

---

## Screenshots

> Replace each placeholder below with a real screenshot. Create a folder such as `docs/screenshots/` and add your images there.

| Screen | Screenshot |
|---|---|
| Landing page | `![Landing page](docs/screenshots/landing.png)` |
| Login / Register | `![Login](docs/screenshots/login.png)` |
| Job search | `![Job search](docs/screenshots/job-search.png)` |
| Candidate dashboard | `![Candidate dashboard](docs/screenshots/candidate-dashboard.png)` |
| Candidate profile | `![Candidate profile](docs/screenshots/candidate-profile.png)` |
| Recruiter dashboard | `![Recruiter dashboard](docs/screenshots/recruiter-dashboard.png)` |
| Recruiter applicants | `![Recruiter applicants](docs/screenshots/recruiter-applicants.png)` |
| Admin dashboard | `![Admin dashboard](docs/screenshots/admin-dashboard.png)` |
| Swagger UI | `![Swagger UI](docs/screenshots/swagger.png)` |

---

## Future Enhancements

**These items are not implemented.** They are ideas, not commitments, and nothing below exists in the current code.

| Idea | Why it could help |
|---|---|
| Database migrations (for example Alembic) | The project currently relies on `create_all`, which cannot alter existing tables |
| Tested PostgreSQL deployment | PostgreSQL is supported only through `DATABASE_URL`; it has not been verified here |
| Rate limiting on login and registration | No rate limiting exists today |
| Automated test suite (pytest and frontend tests) | Only the `smoke_test.py` script exists |
| Email notifications and password reset | No email features exist today |
| Refresh tokens or token revocation | Tokens are valid until they expire |
| Cloud storage for resumes | Resumes are stored on local disk |
| Docker setup and CI pipeline | Neither exists in the repository |

**Currently implemented** features are listed under [Key Features](#key-features).

---

## Security Considerations

| Area | Current behavior | Recommendation |
|---|---|---|
| Secret key | Default is a placeholder | Set a long random `SECRET_KEY` in `backend/.env` and never commit it |
| Admin invite code | Default is `TALENTHUB-ADMIN-2026` (public in this repo) | Change `ADMIN_INVITE_CODE` before any shared or public deployment |
| Demo accounts | Created by the seed script with known passwords | Never run the seed script in production |
| `.env` and database | `.env`, `*.db`, and uploaded resumes are in `.gitignore` | Confirm before each commit that they are not staged |
| Passwords | Salted PBKDF2-HMAC-SHA256, length 8 to 128 | Consider additional strength rules |
| Token storage | JWT kept in browser `localStorage` | Be aware that any XSS vulnerability could expose it |
| CORS | Allows only origins listed in `CORS_ORIGINS` | Set this to your real frontend origin(s) in production |
| Resume access | Downloads require authentication and a permission check | Keep resumes outside any public web root |
| Resume validation | File extension, content type, size, and non-empty checks | Add malware scanning if exposed to the public |
| HTTPS | Not configured by the app | Run behind HTTPS in production |
| Rate limiting | Not implemented | Add it before public deployment |

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `Activate.ps1 cannot be loaded because running scripts is disabled` | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`, then activate again |
| `python` is not recognized | Reinstall Python and tick **Add Python to PATH**, or try `py -m venv .venv` |
| `ModuleNotFoundError: No module named 'fastapi'` | Activate the virtual environment, then run `pip install -r requirements.txt` |
| Frontend shows "Cannot reach the TalentHub API" | Start the backend on port 8000, or set `VITE_API_PROXY_TARGET` to the right address |
| Port 8000 is already in use | Run `uvicorn app.main:app --reload --port 8010` and set `$env:VITE_API_PROXY_TARGET = "http://127.0.0.1:8010"` before `npm run dev` |
| Port 5173 is already in use | Stop the other process using it. Otherwise Vite may start on the next free port, and the URL it prints is the one to open |
| Demo accounts do not work | Run `python -m app.seed --reset` from the `backend` folder |
| Seed script refuses to run | The database is not empty; use `--reset` (this erases existing data) |
| Redirected to login / 401 errors | The token expired or `SECRET_KEY` changed; log in again |
| Browser shows a CORS error | Add your frontend URL to `CORS_ORIGINS` in `backend/.env` and restart the backend |
| Resume upload rejected | Use a PDF, DOC, or DOCX file of 5 MB or less |
| Admin registration rejected | Enter the exact `ADMIN_INVITE_CODE` from `backend/.env` |
| `npm install` fails | Check `node --version` is 18 or newer, then delete `node_modules` and retry |

---

## Contribution Guidelines

Contributions are welcome.

1. Fork the repository and create a branch:
   ```powershell
   git checkout -b feature/your-feature-name
   ```
2. Set up the project as described in [Installation and Setup](#installation-and-setup-windows--powershell).
3. Keep the existing structure: routes stay thin, services call rules, and business rules live in `backend/app/services/rules.py`.
4. When you add or change a business rule, update `backend/app/config.py` if needed, add a row to [`RULES.md`](RULES.md), and add a check to `backend/smoke_test.py`.
5. Run the checks before submitting:
   ```powershell
   cd backend
   python smoke_test.py
   cd ..\frontend
   npm run build
   ```
6. Never commit `.env`, database files, or uploaded resumes.
7. Commit with a clear message and open a pull request describing what changed and why.

