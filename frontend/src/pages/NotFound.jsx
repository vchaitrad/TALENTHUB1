import { Link } from "react-router-dom";
import Icon from "../components/Icons";

export default function NotFound() {
  return (
    <div className="container page">
      <div className="not-found">
        <span className="not-found-code">404</span>
        <h1>This page went looking for another role.</h1>
        <p>
          The page you asked for does not exist, or it moved while you were away. The jobs board
          and your dashboard are still right where you left them.
        </p>
        <div className="not-found-actions">
          <Link to="/jobs" className="btn btn-primary">
            Browse open jobs <Icon name="arrowRight" size={16} />
          </Link>
          <Link to="/" className="btn btn-secondary">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
