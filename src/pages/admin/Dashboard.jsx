import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  API_BASE_URL,
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser
} from "../../lib/auth";
import "../superAdmin/Dashboard.css";

const integerFormatter = new Intl.NumberFormat("en-US");

const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const formatMetricValue = (value) => integerFormatter.format(toNumber(value));

const fetchJson = async (path, token, signal) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Request failed");
  return data;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const controller = new AbortController();

    const loadDashboard = async () => {
      setLoading(true);
      setError("");
      try {
        const me = await verifyBackendUser(token);
        if (String(me?.role || "").toUpperCase() !== "ADMIN") {
          navigate("/dashboard", { replace: true });
          return;
        }

        const projectsRes = await fetchJson("/projects", token, controller.signal);
        setUser(me);
        setProjects(Array.isArray(projectsRes?.data) ? projectsRes.data : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (/token|unauthorized|expired|forbidden/i.test(err.message)) {
          clearStoredTokens();
          navigate("/login", { replace: true });
          return;
        }
        setError(err.message || "Unable to load project dashboard.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadDashboard();
    return () => controller.abort();
  }, [navigate]);

  const myProjects = useMemo(
    () => projects.filter((p) => p?.created_by && user?.id && p.created_by === user.id),
    [projects, user?.id]
  );

  const filteredProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    return projects.filter((project) => {
      const title = String(project?.title || project?.name || "").toLowerCase();
      const status = String(project?.status || "").toUpperCase();
      const byQuery = !term || title.includes(term);
      const byStatus = statusFilter === "ALL" || status === statusFilter;
      return byQuery && byStatus;
    });
  }, [projects, query, statusFilter]);

  const cards = useMemo(() => {
    const publishedCount = projects.filter((p) => String(p?.status || "").toUpperCase() === "PUBLISHED").length;
    const draftCount = projects.filter((p) => String(p?.status || "").toUpperCase() === "DRAFT").length;
    const d2cCount = projects.filter((p) => String(p?.mode || "").toUpperCase() === "D2C").length;
    const marketplaceCount = projects.filter((p) => String(p?.mode || "").toUpperCase() === "MARKETPLACE").length;

    return [
      { title: "My Projects", value: myProjects.length, note: "Created by you" },
      { title: "All Projects", value: projects.length, note: "Across platform" },
      { title: "Published", value: publishedCount, note: `${draftCount} drafts` },
      { title: "Modes", value: d2cCount + marketplaceCount, note: `${marketplaceCount} marketplace / ${d2cCount} d2c` }
    ];
  }, [myProjects.length, projects]);

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  if (loading) return <div className="admin-loading">Loading admin dashboard...</div>;

  return (
    <div className="admin-dashboard">
      <header className="admin-topbar">
        <div className="admin-brand">NITRO</div>
        <div className="admin-userbox">
          <span className="admin-role">{user?.full_name || "Admin"} | Admin</span>
          <button type="button" className="btn btn-sm btn-light" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <ul className="admin-nav list-unstyled">
            <li className="active">
              <button type="button" className="admin-nav-btn" onClick={() => navigate(`/admin/${user?.id}/dashboard`)}>
                <span className="admin-nav-main"><span>Dashboard</span></span>
              </button>
            </li>
            <li>
              <button type="button" className="admin-nav-btn" onClick={() => navigate("/projects/create")}>
                <span className="admin-nav-main"><span>Create Project</span></span>
              </button>
            </li>
            <li>
              <button type="button" className="admin-nav-btn" onClick={() => navigate("/projects/manage")}>
                <span className="admin-nav-main"><span>View All Projects</span></span>
              </button>
            </li>
            <li>
              <button type="button" className="admin-nav-btn" onClick={() => navigate("/admin/applications")}>
                <span className="admin-nav-main"><span>Application Approvals</span></span>
              </button>
            </li>
          </ul>
          <button
            type="button"
            className="btn-primary admin-new-project"
            onClick={() => navigate("/projects/create")}
          >
            + New Project
          </button>
        </aside>

        <main className="admin-main">
          <div className="admin-main-head">
            <div>
              <h1>Project Dashboard</h1>
              <p>Admins can create projects and track their project overview.</p>
            </div>
            <div className="admin-actions">
              <input
                type="text"
                className="form-control"
                placeholder="Search projects..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          {error ? <div className="alert alert-warning mb-3">{error}</div> : null}

          <section className="admin-cards">
            {cards.map((card) => (
              <article key={card.title} className="admin-stat-card">
                <div className="admin-stat-top">
                  <span className="admin-delta positive">{card.note}</span>
                </div>
                <p className="admin-stat-title">{card.title}</p>
                <h3>{formatMetricValue(card.value)}</h3>
              </article>
            ))}
          </section>

          <section className="admin-panel projects-panel mt-4">
            <div className="panel-head">
              <h2>My Projects</h2>
            </div>
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Project Name</th>
                    <th>Created By</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {myProjects.length ? (
                    myProjects.slice(0, 8).map((project) => (
                      <tr key={project.id}>
                        <td>{project.title || project.name || "Untitled"}</td>
                        <td>{project?.created_by === user?.id ? "You" : (project?.created_by || "-")}</td>
                        <td>{project.mode || "-"}</td>
                        <td><span className="badge text-bg-info text-uppercase">{project.status || "unknown"}</span></td>
                        <td>{project.created_at ? new Date(project.created_at).toLocaleDateString() : "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="text-muted">No projects created by you yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-panel projects-panel mt-4">
            <div className="panel-head">
              <h2>All Projects Overview</h2>
            </div>
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Project Name</th>
                    <th>Created By</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.length ? (
                    filteredProjects.slice(0, 20).map((project) => (
                      <tr key={project.id}>
                        <td>{project.title || project.name || "Untitled"}</td>
                        <td>{project?.created_by === user?.id ? "You" : (project?.created_by || "-")}</td>
                        <td>{project.mode || "-"}</td>
                        <td><span className="badge text-bg-info text-uppercase">{project.status || "unknown"}</span></td>
                        <td>{project.created_at ? new Date(project.created_at).toLocaleDateString() : "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="text-muted">No matching projects found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
