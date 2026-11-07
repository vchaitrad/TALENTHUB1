"""TalentHub FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.core.errors import RuleViolation
from app.database import create_tables
from app.routes import admin, applications, auth, candidate, files, jobs, meta, recruiter

API_DESCRIPTION = """
**TalentHub** is a role-based hiring platform with candidate, recruiter and admin accounts.

### Business rules
All business rules live in `backend/app/services/rules.py` and every violation returns a
clear message plus a stable `rule` key. See `RULES.md` for the full catalogue.

### Demo accounts (after running the seed script)
| Role | Email | Password |
|---|---|---|
| Candidate | `candidate@example.com` | `Candidate123!` |
| Recruiter | `recruiter@technova.com` | `Recruiter123!` |
| Admin | `admin@talenthub.dev` | `Admin123!` |

Use **Authorize** with the email as the username and the password to try protected endpoints.
"""


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.resume_path.mkdir(parents=True, exist_ok=True)
    create_tables()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=API_DESCRIPTION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=[
        {"name": "Authentication", "description": "Register, log in and manage your account."},
        {"name": "Jobs", "description": "Public job discovery."},
        {"name": "Candidate", "description": "Candidate profile, resume and applications."},
        {"name": "Applications", "description": "Apply, view and withdraw applications."},
        {"name": "Recruiter", "description": "Company profile, job posting and applicant review."},
        {"name": "Admin", "description": "Platform management and statistics."},
        {"name": "Files", "description": "Private resume downloads."},
        {"name": "Meta", "description": "Statuses and limits used by the frontend."},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RuleViolation)
async def rule_violation_handler(_: Request, exc: RuleViolation) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "rule": exc.rule},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    errors = jsonable_encoder(exc.errors())
    if errors:
        first = errors[0]
        location = ".".join(str(part) for part in first.get("loc", []) if part != "body")
        where = f" ({location})" if location else ""
        detail = f"Invalid input{where}: {first.get('msg', 'please check the request')}"
    else:
        detail = "Invalid request data."
    return JSONResponse(status_code=422, content={"detail": detail, "errors": errors})


for api_router in (
    auth.router,
    jobs.router,
    applications.router,
    candidate.router,
    recruiter.router,
    admin.router,
    files.router,
    meta.router,
):
    app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get(f"{settings.API_PREFIX}/health", tags=["Meta"], summary="Health check")
def health() -> dict:
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": f"{settings.API_PREFIX}/health",
    }
