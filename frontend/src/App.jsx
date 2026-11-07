import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { ToastProvider } from "./components/Toast";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import JobSearch from "./pages/JobSearch";
import JobDetail from "./pages/JobDetail";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";

import CandidateDashboard from "./pages/CandidateDashboard";
import CandidateApplications from "./pages/CandidateApplications";
import CandidateProfile from "./pages/CandidateProfile";

import RecruiterDashboard from "./pages/RecruiterDashboard";
import RecruiterJobs from "./pages/RecruiterJobs";
import RecruiterJobForm from "./pages/RecruiterJobForm";
import RecruiterApplicants from "./pages/RecruiterApplicants";
import RecruiterCompany from "./pages/RecruiterCompany";

import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminJobs from "./pages/AdminJobs";
import AdminApplications from "./pages/AdminApplications";

const BARE_PATHS = new Set(["/login", "/register"]);

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/jobs" element={<JobSearch />} />
      <Route path="/jobs/:jobId" element={<JobDetail />} />

      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <Account />
          </ProtectedRoute>
        }
      />

      <Route
        path="/candidate"
        element={
          <ProtectedRoute roles={["candidate"]}>
            <CandidateDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/candidate/applications"
        element={
          <ProtectedRoute roles={["candidate"]}>
            <CandidateApplications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/candidate/profile"
        element={
          <ProtectedRoute roles={["candidate"]}>
            <CandidateProfile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/recruiter"
        element={
          <ProtectedRoute roles={["recruiter"]}>
            <RecruiterDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recruiter/jobs"
        element={
          <ProtectedRoute roles={["recruiter"]}>
            <RecruiterJobs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recruiter/jobs/new"
        element={
          <ProtectedRoute roles={["recruiter"]}>
            <RecruiterJobForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recruiter/jobs/:jobId/edit"
        element={
          <ProtectedRoute roles={["recruiter"]}>
            <RecruiterJobForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recruiter/jobs/:jobId/applicants"
        element={
          <ProtectedRoute roles={["recruiter"]}>
            <RecruiterApplicants />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recruiter/company"
        element={
          <ProtectedRoute roles={["recruiter"]}>
            <RecruiterCompany />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/jobs"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminJobs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/applications"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminApplications />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function Shell() {
  const location = useLocation();
  const bare = BARE_PATHS.has(location.pathname);

  if (bare) {
    return <AppRoutes />;
  }

  return (
    <Layout>
      <AppRoutes />
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
