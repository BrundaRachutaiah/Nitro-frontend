import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  API_BASE_URL,
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser
} from "../../lib/auth";
import "../superAdmin/AdminPages.css";

const fetchJson = async (path, token, signal) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Request failed");
  return data;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const getBadgeStyle = (status) => {
  const s = String(status || "").toUpperCase();
  if (s === "PUBLISHED") return { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" };
  if (s === "DRAFT") return { background: "#fef9c3", color: "#713f12", border: "1px solid #fef08a" };
  if (s === "ARCHIVED") return { background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" };
  return { background: "#e0f2fe", color: "#0c4a6e", border: "1px solid #bae6fd" };
};

const ClientBudgets = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("PUBLISHED");

  useEffect(() => {
    const token = getStoredToken();
    if (!token) { navigate("/login", { replace: true }); return; }

    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const me = await verifyBackendUser(token);
        const role = String(me?.role || "").toUpperCase();
        if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
          navigate("/dashboard", { replace: true });
          return;
        }
        setUser(me);
        const res = await fetchJson("/projects", token, controller.signal);
        setProjects(Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (/token|unauthorized|expired|forbidden/i.test(err.message)) {
          clearStoredTokens();
          navigate("/login", { replace: true });
          return;
        }
        setError(err.message || "Unable to load budgets.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [navigate]);

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return projects.filter((p) => {
      const title = String(p?.title || p?.name || "").toLowerCase();
      const creator = String(p?.created_by_name || p?.created_by || "").toLowerCase();
      const status = String(p?.status || "").toUpperCase();
      const matchQuery = !term || title.includes(term) || creator.includes(term);
      const matchStatus = statusFilter === "ALL" || status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [projects, query, statusFilter]);

  const stats = useMemo(() => {
    const activeProjects = projects.filter((p) => String(p?.status || "").toUpperCase() === "PUBLISHED");
    const totalBudget = activeProjects.reduce((sum, p) => sum + Number(p?.reward || 0), 0);
    const totalUnits = activeProjects.reduce((sum, p) => sum + Number(p?.total_units || 0), 0);
    const avgBudget = activeProjects.length ? totalBudget / activeProjects.length : 0;
    return { activeCount: activeProjects.length, totalBudget, totalUnits, avgBudget };
  }, [projects]);

  if (loading) return <div className="admin-loading">Loading client budgets...</div>;

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
            <li>
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
            <li className="active">
              <button type="button" className="admin-nav-btn" onClick={() => navigate("/admin/client-budgets")}>
                <span className="admin-nav-main"><span>Client Budgets</span></span>
              </button>
            </li>
            <li>
              <button type="button" className="admin-nav-btn" onClick={() => navigate("/admin/payouts")}>
                <span className="admin-nav-main"><span>Payouts</span></span>
              </button>
            </li>
            <li>
              <button type="button" className="admin-nav-btn" onClick={() => navigate("/admin/payout-history")}>
                <span className="admin-nav-main"><span>Payout History</span></span>
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
              <h1>Client Budgets</h1>
              <p>Allocation amounts given by clients across all active projects.</p>
            </div>
            <div className="admin-actions">
              <input
                type="text"
                className="form-control"
                placeholder="Search project or client..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="PUBLISHED">Active (Published)</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          {error ? <div className="alert alert-warning mb-3">{error}</div> : null}

          <section className="admin-cards" style={{ marginBottom: 24 }}>
            <article className="admin-stat-card">
              <div className="admin-stat-top">
                <span className="admin-delta positive">Currently running</span>
              </div>
              <p className="admin-stat-title">Active Projects</p>
              <h3>{stats.activeCount}</h3>
            </article>
            <article className="admin-stat-card">
              <div className="admin-stat-top">
                <span className="admin-delta positive">All active projects</span>
              </div>
              <p className="admin-stat-title">Total Allocated Budget</p>
              <h3>{formatCurrency(stats.totalBudget)}</h3>
            </article>
            <article className="admin-stat-card">
              <div className="admin-stat-top">
                <span className="admin-delta positive">Across active projects</span>
              </div>
              <p className="admin-stat-title">Total Units</p>
              <h3>{stats.totalUnits}</h3>
            </article>
            <article className="admin-stat-card">
              <div className="admin-stat-top">
                <span className="admin-delta positive">Per active project</span>
              </div>
              <p className="admin-stat-title">Avg. Budget / Project</p>
              <h3>{formatCurrency(stats.avgBudget)}</h3>
            </article>
          </section>

          <section className="admin-panel">
            <div className="panel-head" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                Project Budget Breakdown
                <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 500, color: "#50667d" }}>
                  {filtered.length} project{filtered.length !== 1 ? "s" : ""}
                </span>
              </h2>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Project Name</th>
                    <th>Client / Created By</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Units</th>
                    <th style={{ textAlign: "right" }}>Allocated Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length ? (
                    filtered.map((project, idx) => (
                      <tr key={project.id}>
                        <td style={{ color: "#94a3b8", fontSize: 13 }}>{idx + 1}</td>
                        <td>
                          <strong style={{ color: "#0f172a" }}>
                            {project.title || project.name || "Untitled"}
                          </strong>
                          {project.category ? (
                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                              {project.category}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ color: "#334155" }}>
                          {project.created_by_name || project.created_by || "-"}
                        </td>
                        <td>
                          <span style={{
                            fontSize: 12, fontWeight: 600, padding: "2px 8px",
                            borderRadius: 6, background: "#e0f2fe", color: "#0369a1"
                          }}>
                            {project.mode || "-"}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: 12, fontWeight: 600, padding: "2px 8px",
                            borderRadius: 6, textTransform: "uppercase",
                            ...getBadgeStyle(project.status)
                          }}>
                            {project.status || "unknown"}
                          </span>
                        </td>
                        <td style={{ color: "#475569", fontSize: 13 }}>{formatDate(project.start_date)}</td>
                        <td style={{ color: "#475569", fontSize: 13 }}>{formatDate(project.end_date)}</td>
                        <td style={{ color: "#334155", fontWeight: 600 }}>
                          {project.total_units ?? "-"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <strong style={{
                            fontSize: 15,
                            color: Number(project.reward || 0) > 0 ? "#166534" : "#94a3b8"
                          }}>
                            {Number(project.reward || 0) > 0
                              ? formatCurrency(project.reward)
                              : "—"}
                          </strong>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", color: "#94a3b8", padding: "32px 0" }}>
                        No projects found.
                      </td>
                    </tr>
                  )}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #e2e8f0", background: "#f8fafc" }}>
                      <td colSpan={7} style={{ fontWeight: 700, padding: "12px 10px", color: "#334155" }}>
                        Total ({filtered.length} project{filtered.length !== 1 ? "s" : ""})
                      </td>
                      <td style={{ fontWeight: 700, padding: "12px 10px", color: "#334155" }}>
                        {filtered.reduce((sum, p) => sum + Number(p?.total_units || 0), 0)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, padding: "12px 10px", color: "#166534", fontSize: 16 }}>
                        {formatCurrency(filtered.reduce((sum, p) => sum + Number(p?.reward || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default ClientBudgets;