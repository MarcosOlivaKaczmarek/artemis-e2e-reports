import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";

export function Sidebar() {
  const location = useLocation();
  const { session, status, signIn, signOut } = useAuth();

  function navClass(path: string) {
    const active = path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path);
    return `nav-item${active ? " active" : ""}`;
  }

  return (
    <nav className="sidebar" role="navigation" aria-label="Main navigation">
      <div className="sidebar-logo">
        <span className="sidebar-logo-name">E2E Reports</span>
        <small className="sidebar-logo-sub">ls1intum / artemis</small>
      </div>

      <div className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-label" id="nav-analytics">Analytics</div>
          <NavLink to="/" className={navClass("/")}
            onClick={e => { if (location.pathname === "/") e.preventDefault(); }}>
            <svg className="nav-icon" aria-hidden="true" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="9" width="4" height="6" rx="1"/>
              <rect x="6" y="5" width="4" height="10" rx="1"/>
              <rect x="11" y="1" width="4" height="14" rx="1"/>
            </svg>
            Dashboard
          </NavLink>
          <NavLink to="/runs" className={navClass("/runs")}>
            <svg className="nav-icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="14" height="14" rx="2"/>
              <path d="M5 8h6M5 5h3M5 11h4"/>
            </svg>
            Runs
          </NavLink>
        </div>

        <div className="nav-section">
          <div className="nav-label" id="nav-quality">Quality</div>
          <NavLink to="/flakiness" className={navClass("/flakiness")}>
            <svg className="nav-icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="1,12 5,7 9,10 15,3"/>
            </svg>
            Flakiness
          </NavLink>
        </div>

      </div>

      <div className="sidebar-footer">
        {status === "loading" ? null : session?.user ? (
          <div className="sidebar-footer-user">
            <div className="sidebar-footer-avatar">
              {(session.user.name || session.user.email || "U").charAt(0).toUpperCase()}
            </div>
            <span className="sidebar-footer-name">{session.user.name || session.user.email}</span>
            <button type="button" className="sidebar-signout" onClick={() => signOut()}>out</button>
          </div>
        ) : status === "unauthenticated" && session?.authEnabled ? (
          <button type="button" className="sidebar-signin" onClick={() => signIn()}>
            Sign in with GitHub
          </button>
        ) : null}
        <div className="sidebar-footer-info">
          Artemis E2E Reports
        </div>
      </div>
    </nav>
  );
}
