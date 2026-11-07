import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Spinner } from "./ui";
import Icon from "./Icons";

export default function ProtectedRoute({ roles, children }) {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (booting) {
    return (
      <div className="full-loader">
        <Spinner size={28} label="Checking your session…" />
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="container page">
        <div className="access-denied">
          <span className="access-icon">
            <Icon name="shield" size={30} />
          </span>
          <h1>This area is for {roles.join(" or ")} accounts</h1>
          <p>
            You are signed in as a {user.role}. Head back to your dashboard to keep working.
          </p>
          <a className="btn btn-primary" href={user.role === "admin" ? "/admin" : user.role === "recruiter" ? "/recruiter" : "/candidate"}>
            Go to my dashboard
          </a>
        </div>
      </div>
    );
  }

  return children;
}
