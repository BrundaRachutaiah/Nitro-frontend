import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApplicationSummary } from "../../api/admin.api";
import {
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser,
} from "../../lib/auth";
import "../superAdmin/Dashboard.css";

const Icon = ({ name, size = 18 }) => {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    dashboard:    <svg {...p}><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></svg>,
    participants: <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    projects:     <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></svg>,
    approvals:    <svg {...p}><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>,
    budgets:      <svg {...p}><path d="M3 7h18v10H3z"/><path d="M3 10h18M8 14h2"/></svg>,
    payouts:      <svg {...p}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    history:      <svg {...p}><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>,
    reports:      <svg {...p}><path d="M4 19h16M7 16V8M12 16V5M17 16v-3"/></svg>,
    support:      <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.3 1.7c-.7.7-1.3 1.1-1.3 2.3M12 17h.01"/></svg>,
    menu:         <svg {...p}><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
    close:        <svg {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>,
    refresh:      <svg {...p}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
    alert:        <svg {...p}><path d="m10.29 3.86-8.6 14.9A1 1 0 0 0 2.57 20h16.86a1 1 0 0 0 .88-1.24l-8.6-14.9a1 1 0 0 0-1.72 0z"/><path d="M12 9v4M12 17h.01"/></svg>,
    arrowLeft:    <svg {...p}><path d="M19 12H5M12 5l-7 7 7 7"/></svg>,
    arrow:        <svg {...p}><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
    login:        <svg {...p}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>,
    package:      <svg {...p}><path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>,
    file:         <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    clock:        <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>,
  };
  return icons[name] || <svg {...p}><circle cx="12" cy="12" r="9"/></svg>;
};

const NAV_ITEMS = [
  { key: "dashboard",      label: "Dashboard",      icon: "dashboard",    path: "/dashboard" },
  { key: "participants",   label: "Participants",    icon: "participants", path: "/super-admin/users" },
  { key: "projects",       label: "Projects",        icon: "projects",     path: "/projects/manage" },
  { key: "approvals",      label: "Approvals",       icon: "approvals",    path: "/admin/applications" },
  { key: "client_budgets", label: "Client Budgets",  icon: "budgets",      path: "/admin/client-budgets" },
  { key: "payouts",        label: "Payouts",         icon: "payouts",      path: "/admin/payouts" },
  { key: "payout_history", label: "Payout History",  icon: "history",      path: "/admin/payout-history" },
  { key: "reports",        label: "Reports",         icon: "reports",      path: "/super-admin/reports" },
  { key: "support",        label: "Support",         icon: "support",      path: "/super-admin/support" },
];

const emptySummary = {
  login_requests:          { pending_count: 0, approved_count: 0, rejected_count: 0, total_requested: 0 },
  product_applications:    { pending_count: 0, approved_count: 0, rejected_count: 0, total_requested: 0 },
  invoice_submissions:     { pending_count: 0, approved_count: 0, rejected_count: 0, total_requested: 0 },
  review_submissions:      { pending_count: 0, approved_count: 0, rejected_count: 0, total_requested: 0 },
};

const ApplicationApprovals = () => {
  const navigate = useNavigate();
  const [user, setUser]             = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [summary, setSummary]       = useState(emptySummary);

  useEffect(() => {
    const init = async () => {
      const token = getStoredToken();
      if (!token) { navigate("/login", { replace: true }); return; }
      try { const me = await verifyBackendUser(token); setUser(me); }
      catch { navigate("/login", { replace: true }); }
    };
    init();
  }, [navigate]);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const res = await getApplicationSummary();
      setSummary(res?.data?.data || emptySummary);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load application summary.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  const rows = [
    {
      key: "login",
      label: "Login Request for Participant",
      icon: "login",
      tone: "blue",
      pending:  summary.login_requests?.pending_count  || 0,
      approved: summary.login_requests?.approved_count || 0,
      rejected: summary.login_requests?.rejected_count || 0,
      total:    summary.login_requests?.total_requested || 0,
      path: "/admin/applications/login-requests",
    },
    {
      key: "product",
      label: "Product Applications",
      icon: "package",
      tone: "cyan",
      pending:  summary.product_applications?.pending_count  || 0,
      approved: summary.product_applications?.approved_count || 0,
      rejected: summary.product_applications?.rejected_count || 0,
      total:    summary.product_applications?.total_requested || 0,
      path: "/admin/applications/product-applications",
    },
    {
      key: "invoice_review",
      label: "Invoice + Review Submissions",
      icon: "file",
      tone: "amber",
      pending:  (summary.invoice_submissions?.pending_count  || 0) + (summary.review_submissions?.pending_count  || 0),
      approved: (summary.invoice_submissions?.approved_count || 0) + (summary.review_submissions?.approved_count || 0),
      rejected: (summary.invoice_submissions?.rejected_count || 0) + (summary.review_submissions?.rejected_count || 0),
      total:    (summary.invoice_submissions?.total_requested || 0) + (summary.review_submissions?.total_requested || 0),
      path: "/admin/verification?uploadType=ALL&status=ALL",
    },
  ];

  const final = rows.reduce((acc, r) => ({
    pending:  acc.pending  + r.pending,
    approved: acc.approved + r.approved,
    rejected: acc.rejected + r.rejected,
    total:    acc.total    + r.total,
  }), { pending: 0, approved: 0, rejected: 0, total: 0 });

  // Stat cards
  const statCards = [
    { title: "Total Pending",  value: final.pending,  icon: "clock",    tone: final.pending > 0 ? "amber" : "blue" },
    { title: "Total Approved", value: final.approved, icon: "approvals", tone: "green" },
    { title: "Total Rejected", value: final.rejected, icon: "alert",     tone: "red" },
    { title: "All Requests",   value: final.total,    icon: "reports",   tone: "cyan" },
  ];

  const toneColors = { blue: "var(--accent)", cyan: "var(--cyan)", amber: "var(--amber)", green: "var(--green)", red: "var(--danger)" };

  return (
    <div className="sa-dashboard">
      <header className="sa-topbar">
        <button type="button" className="sa-menu-btn" onClick={() => setIsSidebarOpen(v => !v)}>
          <Icon name={isSidebarOpen ? "close" : "menu"} size={20} />
        </button>
        <div className="sa-brand"><span className="sa-brand-n">N</span>ITRO</div>
        <div className="sa-topbar-right" style={{ marginLeft: "auto" }}>
          <div className="sa-user-pill">
            <div className="sa-user-avatar">{String(user?.full_name || user?.email || "A")[0].toUpperCase()}</div>
            <div className="sa-user-info">
              <span className="sa-user-name">{user?.full_name || user?.email || "Admin"}</span>
              <span className="sa-user-role">{user?.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</span>
            </div>
          </div>
          <button type="button" className="sa-logout" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="sa-layout">
        {isSidebarOpen && <button type="button" className="sa-backdrop" onClick={() => setIsSidebarOpen(false)} />}
        <aside className={`sa-sidebar ${isSidebarOpen ? "sa-sidebar--open" : ""}`}>
          <nav className="sa-nav">
            {NAV_ITEMS.map(item => (
              <button key={item.key} type="button"
                className={`sa-nav-item ${item.key === "approvals" ? "sa-nav-item--active" : ""}`}
                onClick={() => { setIsSidebarOpen(false); navigate(item.path); }}>
                <span className="sa-nav-icon"><Icon name={item.icon} size={18} /></span>
                <span className="sa-nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
          <button type="button" className="sa-new-project-btn" onClick={() => navigate("/projects/create")}>
            <span>+</span> New Project
          </button>
        </aside>

        <main className="sa-main">
          <div className="sa-page-head">
            <div className="sa-page-head-left">
              <h1 className="sa-page-title">Application <span className="sa-highlight">Summary</span></h1>
              <p className="sa-page-sub">Track and open each approval queue in a separate page</p>
              {lastUpdated && !loading && (
                <p className="app-last-updated">
                  <Icon name="clock" size={12} /> Last updated: {lastUpdated.toLocaleString()}
                </p>
              )}
            </div>
            <div className="sa-page-actions">
              <button type="button" className="sa-export-btn" onClick={() => navigate("/dashboard")}>
                <Icon name="arrowLeft" size={16} /><span>Back</span>
              </button>
              <button type="button" className="sa-export-btn" onClick={load} disabled={loading}>
                <Icon name="refresh" size={16} /><span>{loading ? "Loading…" : "Refresh"}</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="sa-error"><Icon name="alert" size={16} /> {error}
              <button type="button" onClick={() => setError("")}>✕</button>
            </div>
          )}

          {/* Stat cards */}
          <div className="sa-cards">
            {statCards.map((card, i) => (
              <article key={card.title} className={`sa-stat-card sa-stat-card--${card.tone}`} style={{ animationDelay: `${i * 80}ms` }}>
                <div className="sa-stat-card-top">
                  <div className={`sa-stat-icon sa-stat-icon--${card.tone}`}><Icon name={card.icon} size={20} /></div>
                </div>
                <p className="sa-stat-label">{card.title}</p>
                <div className="sa-stat-value">{loading ? "—" : card.value}</div>
              </article>
            ))}
          </div>

          {/* Main requests table */}
          <div className="sa-panel sa-panel--table">
            <div className="sa-panel-head">
              <div>
                <h2 className="sa-panel-title">Requests</h2>
                <p className="sa-panel-sub">Click "View Details" to manage each queue</p>
              </div>
            </div>

            {loading ? (
              <div className="pd-loading"><div className="sa-spinner" /><p>Loading summary…</p></div>
            ) : (
              <div className="sa-table-wrap" style={{ marginTop: 0 }}>
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Pending</th>
                      <th>Approved</th>
                      <th>Rejected</th>
                      <th>Total</th>
                      <th>Open Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.key} className="sa-table-row--clickable">
                        <td>
                          <div className="app-row-label">
                            <span className="app-row-icon" style={{ color: toneColors[row.tone] }}>
                              <Icon name={row.icon} size={15} />
                            </span>
                            {row.label}
                          </div>
                        </td>
                        <td>
                          <span className={`app-count ${row.pending > 0 ? "app-count--pending" : ""}`}>
                            {row.pending}
                          </span>
                        </td>
                        <td><span className="app-count app-count--approved">{row.approved}</span></td>
                        <td><span className="app-count app-count--rejected">{row.rejected}</span></td>
                        <td><span className="sa-td-bold">{row.total || "—"}</span></td>
                        <td>
                          <button type="button" className="su-action-btn su-action-btn--ghost app-view-btn"
                            onClick={() => navigate(row.path)}>
                            View Details <Icon name="arrow" size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Final Summary row */}
                    <tr className="app-summary-row">
                      <td><strong>Final Summary</strong></td>
                      <td><span className={`app-count ${final.pending > 0 ? "app-count--pending" : ""}`}><strong>{final.pending}</strong></span></td>
                      <td><span className="app-count app-count--approved"><strong>{final.approved}</strong></span></td>
                      <td><span className="app-count app-count--rejected"><strong>{final.rejected}</strong></span></td>
                      <td><strong>{final.total}</strong></td>
                      <td>
                        <button type="button" className="su-action-btn su-action-btn--approve app-view-btn"
                          onClick={() => navigate("/admin/applications/all-requests")}>
                          View All <Icon name="arrow" size={13} />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick-access cards */}
          <div className="app-quick-grid">
            {rows.map(row => (
              <button key={row.key} type="button" className="app-quick-card"
                onClick={() => navigate(row.path)}>
                <div className="app-quick-icon" style={{ background: `${toneColors[row.tone]}18`, color: toneColors[row.tone] }}>
                  <Icon name={row.icon} size={22} />
                </div>
                <div className="app-quick-body">
                  <span className="app-quick-title">{row.label}</span>
                  {row.pending > 0 && (
                    <span className="app-quick-badge">{row.pending} pending</span>
                  )}
                </div>
                <Icon name="arrow" size={16} />
              </button>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ApplicationApprovals;