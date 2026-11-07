"""End-to-end API smoke test for TalentHub.

Run from the backend folder:

    .venv\\Scripts\\python smoke_test.py

It uses a throwaway SQLite database and upload folder, exercises the main
routes and business rules, and exits non-zero on failure. It never touches
talenthub.db or your uploaded resumes.
"""

from __future__ import annotations

import os
import shutil
from datetime import date, timedelta
from pathlib import Path

BASE = Path(__file__).resolve().parent
SMOKE_DB = BASE / "smoke_test.db"
SMOKE_UPLOADS = BASE / "smoke_test_uploads"

if SMOKE_DB.exists():
    SMOKE_DB.unlink()
if SMOKE_UPLOADS.exists():
    shutil.rmtree(SMOKE_UPLOADS)

# Environment must be set before importing app settings.
os.environ["DATABASE_URL"] = f"sqlite:///{SMOKE_DB.as_posix()}"
os.environ["UPLOAD_DIR"] = str(SMOKE_UPLOADS)
os.environ["SECRET_KEY"] = "smoke-test-secret-key-that-is-long-enough"
os.environ["ADMIN_INVITE_CODE"] = "SMOKE-INVITE"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import engine  # noqa: E402
from app.main import app  # noqa: E402

PASSED = 0


def check(label: str, condition: bool, detail: object = "") -> None:
    global PASSED
    if not condition:
        raise AssertionError(f"FAILED: {label} {detail}")
    PASSED += 1
    print(f"  ok  {label}")


def register(client: TestClient, email: str, name: str, role: str, password: str = "Passw0rd!") -> dict:
    payload = {"email": email, "full_name": name, "password": password, "role": role}
    if role == "admin":
        payload["admin_invite_code"] = "SMOKE-INVITE"
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def main() -> None:
    with TestClient(app) as client:
        print("\nHealth & meta")
        check("health", client.get("/api/health").status_code == 200)
        options = client.get("/api/meta/options").json()
        check("meta includes transitions", "applied" in options["application_status_transitions"])
        check("admin invite code is not exposed", "SMOKE-INVITE" not in str(options))

        print("\nRegistration & auth")
        candidate = register(client, "candidate@test.dev", "Casey Candidate", "candidate")
        candidate2 = register(client, "second@test.dev", "Sam Second", "candidate")
        candidate3 = register(client, "third@test.dev", "Toni Third", "candidate")
        recruiter = register(client, "recruiter@test.dev", "Riley Recruiter", "recruiter")
        recruiter2 = register(client, "other@test.dev", "Other Recruiter", "recruiter")
        admin = register(client, "admin@test.dev", "Ada Admin", "admin")

        bad_admin = client.post(
            "/api/auth/register",
            json={
                "email": "fakeadmin@test.dev",
                "full_name": "Fake Admin",
                "password": "Passw0rd!",
                "role": "admin",
                "admin_invite_code": "WRONG",
            },
        )
        check("admin invite rule", bad_admin.status_code == 403 and bad_admin.json()["rule"] == "admin_invite_code")

        duplicate = client.post(
            "/api/auth/register",
            json={"email": "candidate@test.dev", "full_name": "Copy", "password": "Passw0rd!"},
        )
        check("unique email rule", duplicate.status_code == 409 and duplicate.json()["rule"] == "unique_email")

        short_pw = client.post(
            "/api/auth/register",
            json={"email": "short@test.dev", "full_name": "Short", "password": "abc"},
        )
        check("password policy rule", short_pw.status_code == 400 and short_pw.json()["rule"] == "password_policy")

        login = client.post(
            "/api/auth/login",
            json={"email": "candidate@test.dev", "password": "Passw0rd!"},
        )
        check("json login", login.status_code == 200 and login.json()["access_token"])
        check("me", client.get("/api/auth/me", headers=auth(candidate["access_token"])).status_code == 200)

        print("\nRecruiter company & job creation")
        no_company = client.post(
            "/api/recruiter/jobs",
            headers=auth(recruiter["access_token"]),
            json={
                "title": "No Company Job",
                "description": "This job creation should fail because the recruiter has no company profile yet.",
                "location": "Remote",
                "deadline": (date.today() + timedelta(days=10)).isoformat(),
                "status": "open",
            },
        )
        check("company required rule", no_company.status_code == 400 and no_company.json()["rule"] == "company_profile_required")

        company = client.put(
            "/api/recruiter/company",
            headers=auth(recruiter["access_token"]),
            json={
                "name": "Smoke Labs",
                "website": "https://smoke.example.com",
                "industry": "Testing",
                "location": "Remote",
                "description": "A company created by the smoke test.",
            },
        )
        check("create company", company.status_code == 200, company.text)
        check(
            "one company per recruiter",
            client.put(
                "/api/recruiter/company",
                headers=auth(recruiter["access_token"]),
                json={"name": "Renamed Smoke Labs"},
            ).status_code
            == 200,
        )

        bad_salary = client.post(
            "/api/recruiter/jobs",
            headers=auth(recruiter["access_token"]),
            json={
                "title": "Bad Salary Job",
                "description": "This job has an invalid salary range and must be rejected by the rules layer.",
                "location": "Remote",
                "salary_min": 200000,
                "salary_max": 100000,
                "deadline": (date.today() + timedelta(days=10)).isoformat(),
                "status": "open",
            },
        )
        check("salary range rule", bad_salary.status_code == 400 and bad_salary.json()["rule"] == "job_salary_range")

        past_deadline = client.post(
            "/api/recruiter/jobs",
            headers=auth(recruiter["access_token"]),
            json={
                "title": "Past Deadline Job",
                "description": "Publishing a job with a past deadline must be rejected by the rules layer.",
                "location": "Remote",
                "deadline": (date.today() - timedelta(days=1)).isoformat(),
                "status": "open",
            },
        )
        check("deadline rule", past_deadline.status_code == 400 and past_deadline.json()["rule"] == "job_deadline")

        job_payload = {
            "title": "Full Stack Engineer",
            "description": "Build features across the stack in a small product team with a strong learning culture.",
            "location": "Remote",
            "employment_type": "full-time",
            "experience_level": "Mid-level",
            "salary_min": 90000,
            "salary_max": 130000,
            "skills_required": ["Python", "React", "SQL"],
            "openings": 2,
            "deadline": (date.today() + timedelta(days=14)).isoformat(),
            "status": "open",
        }
        job_response = client.post(
            "/api/recruiter/jobs", headers=auth(recruiter["access_token"]), json=job_payload
        )
        check("create job", job_response.status_code == 201, job_response.text)
        job = job_response.json()
        job_id = job["id"]
        check("job is listed publicly", any(j["id"] == job_id for j in client.get("/api/jobs").json()["items"]))
        check(
            "search filter",
            any(j["id"] == job_id for j in client.get("/api/jobs", params={"q": "Full Stack"}).json()["items"]),
        )

        print("\nApplications & ownership")
        apply1 = client.post(
            f"/api/jobs/{job_id}/applications",
            headers=auth(candidate["access_token"]),
            json={"cover_letter": "I would love this role."},
        )
        check("candidate applies", apply1.status_code == 201, apply1.text)
        app1 = apply1.json()
        check("initial status applied", app1["status"] == "applied")

        apply2 = client.post(
            f"/api/jobs/{job_id}/applications",
            headers=auth(candidate2["access_token"]),
            json={"cover_letter": "Second applicant."},
        )
        check("second candidate applies", apply2.status_code == 201, apply2.text)
        app2 = apply2.json()

        duplicate_apply = client.post(
            f"/api/jobs/{job_id}/applications",
            headers=auth(candidate["access_token"]),
            json={"cover_letter": "Again."},
        )
        check("duplicate application rule", duplicate_apply.status_code == 409 and duplicate_apply.json()["rule"] == "duplicate_application")

        other_recruiter = client.get(
            f"/api/recruiter/jobs/{job_id}/applications",
            headers=auth(recruiter2["access_token"]),
        )
        check("applicant ownership rule", other_recruiter.status_code == 403 and other_recruiter.json()["rule"] == "applicant_management")

        owner_applicants = client.get(
            f"/api/recruiter/jobs/{job_id}/applications",
            headers=auth(recruiter["access_token"]),
        )
        check("owner sees applicants", owner_applicants.status_code == 200 and len(owner_applicants.json()) == 2)

        hidden_application = client.get(
            f"/api/applications/{app1['id']}",
            headers=auth(candidate3["access_token"]),
        )
        check("application visibility rule", hidden_application.status_code == 403 and hidden_application.json()["rule"] == "application_visibility")

        print("\nStatus transitions")
        invalid_jump = client.patch(
            f"/api/recruiter/applications/{app2['id']}/status",
            headers=auth(recruiter["access_token"]),
            json={"status": "hired"},
        )
        check(
            "invalid application transition",
            invalid_jump.status_code == 409
            and invalid_jump.json()["rule"] == "application_status_transition",
            invalid_jump.text,
        )

        shortlist = client.patch(
            f"/api/recruiter/applications/{app2['id']}/status",
            headers=auth(recruiter["access_token"]),
            json={"status": "shortlisted", "note": "Strong portfolio."},
        )
        check("applied -> shortlisted", shortlist.status_code == 200 and shortlist.json()["status"] == "shortlisted", shortlist.text)

        interview = client.patch(
            f"/api/recruiter/applications/{app2['id']}/status",
            headers=auth(recruiter["access_token"]),
            json={"status": "interview"},
        )
        check("shortlisted -> interview", interview.status_code == 200)

        cannot_withdraw = client.post(
            f"/api/applications/{app2['id']}/withdraw",
            headers=auth(candidate2["access_token"]),
            json={"note": "Changed my mind."},
        )
        check("withdraw stage rule", cannot_withdraw.status_code == 409 and cannot_withdraw.json()["rule"] == "application_withdrawable")

        withdraw = client.post(
            f"/api/applications/{app1['id']}/withdraw",
            headers=auth(candidate["access_token"]),
            json={"note": "Accepted another offer."},
        )
        check("withdraw applied application", withdraw.status_code == 200 and withdraw.json()["status"] == "withdrawn")

        reapply = client.post(
            f"/api/jobs/{job_id}/applications",
            headers=auth(candidate["access_token"]),
            json={"cover_letter": "Trying again."},
        )
        check("cannot reapply after withdrawal", reapply.status_code == 409 and reapply.json()["rule"] == "duplicate_application")

        job_transition = client.patch(
            f"/api/recruiter/jobs/{job_id}/status",
            headers=auth(recruiter["access_token"]),
            json={"status": "draft"},
        )
        check("invalid job transition", job_transition.status_code == 409 and job_transition.json()["rule"] == "job_status_transition")

        close = client.patch(
            f"/api/recruiter/jobs/{job_id}/status",
            headers=auth(recruiter["access_token"]),
            json={"status": "closed"},
        )
        check("close job", close.status_code == 200 and close.json()["status"] == "closed")

        apply_closed = client.post(
            f"/api/jobs/{job_id}/applications",
            headers=auth(candidate3["access_token"]),
            json={"cover_letter": "Applying after close."},
        )
        check("closed job rule", apply_closed.status_code == 409 and apply_closed.json()["rule"] == "job_accepting_applications")

        print("\nProfiles & resumes")
        profile_update = client.put(
            "/api/candidate/profile",
            headers=auth(candidate["access_token"]),
            json={
                "headline": "Full stack developer",
                "summary": "I build web applications.",
                "phone": "+1 555 0100",
                "location": "Remote",
                "skills": ["Python", "React", "python"],
                "education": [],
                "experience": [],
            },
        )
        check("update own profile", profile_update.status_code == 200, profile_update.text)
        check("skills deduplicated", profile_update.json()["skills"] == ["Python", "React"])
        profile_id = profile_update.json()["id"]

        admin_profile = client.get(
            f"/api/admin/candidates/{candidate['user']['id']}/profile",
            headers=auth(admin["access_token"]),
        )
        check("admin reads candidate profile", admin_profile.status_code == 200)

        bad_resume = client.post(
            "/api/candidate/resume",
            headers=auth(candidate["access_token"]),
            files={"file": ("resume.txt", b"plain text", "text/plain")},
        )
        check("resume type rule", bad_resume.status_code == 400 and bad_resume.json()["rule"] == "resume_file")

        good_resume = client.post(
            "/api/candidate/resume",
            headers=auth(candidate["access_token"]),
            files={"file": ("resume.pdf", b"%PDF-1.4\nsmoke test resume\n%%EOF", "application/pdf")},
        )
        check("upload resume", good_resume.status_code == 200 and good_resume.json()["has_resume"], good_resume.text)

        other_candidate_resume = client.get(
            f"/api/files/resumes/{profile_id}",
            headers=auth(candidate2["access_token"]),
        )
        check("resume access rule", other_candidate_resume.status_code == 403 and other_candidate_resume.json()["rule"] == "resume_access")

        recruiter_resume = client.get(
            f"/api/files/resumes/{profile_id}",
            headers=auth(recruiter["access_token"]),
        )
        check("connected recruiter downloads resume", recruiter_resume.status_code == 200 and recruiter_resume.content.startswith(b"%PDF"))

        admin_resume = client.get(
            f"/api/files/resumes/{profile_id}",
            headers=auth(admin["access_token"]),
        )
        check("admin downloads resume", admin_resume.status_code == 200)

        print("\nAdmin")
        stats = client.get("/api/admin/stats", headers=auth(admin["access_token"]))
        check("admin stats", stats.status_code == 200 and stats.json()["users_total"] >= 6, stats.text)

        users = client.get("/api/admin/users", headers=auth(admin["access_token"])).json()
        check("admin lists users", len(users) >= 6)

        disable = client.patch(
            f"/api/admin/users/{candidate3['user']['id']}/status",
            headers=auth(admin["access_token"]),
            json={"status": "disabled"},
        )
        check("admin disables user", disable.status_code == 200, disable.text)

        disabled_login = client.post(
            "/api/auth/login",
            json={"email": "third@test.dev", "password": "Passw0rd!"},
        )
        check("disabled account rule", disabled_login.status_code == 403 and disabled_login.json()["rule"] == "account_active")

        self_disable = client.patch(
            f"/api/admin/users/{admin['user']['id']}/status",
            headers=auth(admin["access_token"]),
            json={"status": "disabled"},
        )
        check("cannot disable self", self_disable.status_code == 403 and self_disable.json()["rule"] == "cannot_disable_self")

        admin_jobs = client.get("/api/admin/jobs", headers=auth(admin["access_token"]))
        check("admin lists jobs", admin_jobs.status_code == 200 and len(admin_jobs.json()) >= 1)

        admin_apps = client.get("/api/admin/applications", headers=auth(admin["access_token"]))
        check("admin lists applications", admin_apps.status_code == 200 and len(admin_apps.json()) >= 2)

        reopen = client.patch(
            f"/api/admin/jobs/{job_id}/status",
            headers=auth(admin["access_token"]),
            json={"status": "open"},
        )
        check("admin reopens job", reopen.status_code == 200 and reopen.json()["status"] == "open")

        docs = client.get("/openapi.json")
        check("OpenAPI docs schema", docs.status_code == 200 and "/api/jobs" in docs.json()["paths"])

    engine.dispose()
    if SMOKE_DB.exists():
        SMOKE_DB.unlink()
    if SMOKE_UPLOADS.exists():
        shutil.rmtree(SMOKE_UPLOADS)

    print(f"\nAll {PASSED} smoke checks passed.\n")


if __name__ == "__main__":
    main()
