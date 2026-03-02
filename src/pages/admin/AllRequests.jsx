import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllParticipants,
  getProductApplications,
  getProjectAccessRequests,
} from "../../api/admin.api";
import {
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser,
} from "../../lib/auth";
import "../superAdmin/Dashboard.css";

const fmtDate = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

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
    filter:       <svg {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
    login:        <svg {...p}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>,
    unlock:       <svg {...p}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>,
    package:      <svg {...p}><path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>,
    mail:         <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
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

const StatusBadge = ({ status }) => {
  const s = String(status || "").toUpperCase();
  const map = {
    APPROVED: { cls: "sa-status-badge--published", label: "Approved" },
    PENDING:  { cls: "sa-status-badge--pending",   label: "Pending" },
    REJECTED: { cls: "sa-status-badge--rejected",  label: "Rejected" },
  };
  const { cls, label } = map[s] || { cls: "sa-status-badge--draft", label: status || "—" };
  return <span className={`sa-status-badge sa-status-badge--sm ${cls}`}>{label}</span>;
};

const AllRequests = () => {
  const navigate = useNavigate();
  const [user, setUser]             = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [data, setData]             = useState({ loginRequests: [], unlockRequests: [], productApplications: [] });

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
      const [loginRes, unlockRes, productRes] = await Promise.all([
        getAllParticipants(),
        getProjectAccessRequests({ status: statusFilter }),
        getProductApplications({ status: statusFilter }),
      ]);
      const allParticipants = Array.isArray(loginRes?.data?.data) ? loginRes.data.data : [];
      setData({
        loginRequests:       statusFilter === "ALL" ? allParticipants : allParticipants.filter(r => String(r.status || "").toUpperCase() === statusFilter),
        unlockRequests:      Array.isArray(unlockRes?.data?.data) ? unlockRes.data.data : [],
        productApplications: Array.isArray(productRes?.data?.data) ? productRes.data.data : [],
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load all requests.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  const statCards = [
    { title: "Login Requests",       value: data.loginRequests.length,       icon: "login",   tone: "blue",  path: "/admin/applications/login-requests" },
    { title: "Project Unlocks",      value: data.unlockRequests.length,       icon: "unlock",  tone: "cyan",  path: null },
    { title: "Product Applications", value: data.productApplications.length,  icon: "package", tone: "amber", path: "/admin/applications/product-applications" },
  ];

  const sections = [
    {
      key: "login",
      title: "Login Requests",
      icon: "login",
      tone: "blue",
      data: data.loginRequests,
      cols: ["Name", "Email", "Status", "Requested At"],
      renderRow: (row) => (
        <tr key={row.id} className="sa-table-row--clickable">
          <td>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="su-user-avatar-sm">{String(row.full_name || row.email || "?")[0].toUpperCase()}</div>
              <span className="sa-td-main">{row.full_name || "—"}</span>
            </div>
          </td>
          <td className="sa-td-muted"><span style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon name="mail" size={12} />{row.email || "—"}</span></td>
          <td><StatusBadge status={row.status} /></td>
          <td className="sa-td-muted">{fmtDate(row.created_at)}</td>
        </tr>
      ),
      emptyIcon: "login",
      emptyMsg: "No login requests found.",
    },
    {
      key: "unlock",
      title: "Project Unlock Requests",
      icon: "unlock",
      tone: "cyan",
      data: data.unlockRequests,
      cols: ["Participant", "Project", "Status", "Requested At"],
      renderRow: (row) => (
        <tr key={row.id} className="sa-table-row--clickable">
          <td>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="su-user-avatar-sm">{String(row?.profiles?.full_name || "?")[0].toUpperCase()}</div>
              <span className="sa-td-main">{row?.profiles?.full_name || row?.participant_id || "—"}</span>
            </div>
          </td>
          <td className="sa-td-muted">{row?.projects?.title || row?.project_id || "—"}</td>
          <td><StatusBadge status={row.status} /></td>
          <td className="sa-td-muted">{fmtDate(row.created_at)}</td>
        </tr>
      ),
      emptyIcon: "unlock",
      emptyMsg: "No project unlock requests found.",
    },
    {
      key: "product",
      title: "Product Applications",
      icon: "package",
      tone: "amber",
      data: data.productApplications,
      cols: ["Participant", "Project", "Product", "Status", "Requested At"],
      renderRow: (row) => (
        <tr key={row.id} className="sa-table-row--clickable">
          <td>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="su-user-avatar-sm">{String(row?.profiles?.full_name || "?")[0].toUpperCase()}</div>
              <span className="sa-td-main">{row?.profiles?.full_name || row?.participant_id || "—"}</span>
            </div>
          </td>
          <td className="sa-td-muted">{row?.projects?.title || row?.project_id || "—"}</td>
          <td className="sa-td-muted">{row?.project_products?.name || row?.product_id || "—"}</td>
          <td><StatusBadge status={row.status} /></td>
          <td className="sa-td-muted">{fmtDate(row.created_at)}</td>
        </tr>
      ),
      emptyIcon: "package",
      emptyMsg: "No product applications found.",
    },
  ];

  const toneColors = { blue: "var(--accent)", cyan: "var(--cyan)", amber: "var(--amber)" };

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
              <div className="pd-breadcrumb">
                <button type="button" className="pd-breadcrumb-link" onClick={() => navigate("/admin/applications")}>Approvals</button>
                <span className="pd-breadcrumb-sep">/</span>
                <span>All Requests</span>
              </div>
              <h1 className="sa-page-title">All <span className="sa-highlight">Requests</span></h1>
              <p className="sa-page-sub">Combined view of login, project unlock, and product application history</p>
            </div>
            <div className="sa-page-actions">
              <div className="pj-filter-left">
                <Icon name="filter" size={14} style={{ color: "var(--text-3)" }} />
                <select className="pj-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <button type="button" className="sa-export-btn" onClick={() => navigate("/admin/applications")}>
                <Icon name="arrowLeft" size={16} /><span>Back</span>
              </button>
              <button type="button" className="sa-export-btn" onClick={load} disabled={loading}>
                <Icon name="refresh" size={16} /><span>{loading ? "Loading…" : "Refresh"}</span>
              </button>
            </div>
          </div>

          {error && <div className="sa-error"><Icon name="alert" size={16} /> {error}<button type="button" onClick={() => setError("")}>✕</button></div>}

          {/* Summary stat cards */}
          <div className="sa-cards">
            {statCards.map((card, i) => (
              <article key={card.title}
                className={`sa-stat-card sa-stat-card--${card.tone}`}
                style={{ animationDelay: `${i * 80}ms`, cursor: card.path ? "pointer" : "default" }}
                onClick={() => card.path && navigate(card.path)}
                role={card.path ? "button" : undefined}
                tabIndex={card.path ? 0 : undefined}>
                <div className="sa-stat-card-top">
                  <div className={`sa-stat-icon sa-stat-icon--${card.tone}`}><Icon name={card.icon} size={20} /></div>
                </div>
                <p className="sa-stat-label">{card.title}</p>
                <div className="sa-stat-value">{loading ? "—" : card.value}</div>
              </article>
            ))}
          </div>

          {/* 3 sections */}
          {sections.map(section => (
            <div key={section.key} className="sa-panel sa-panel--table">
              <div className="sa-panel-head">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: toneColors[section.tone] }}><Icon name={section.icon} size={18} /></span>
                  <div>
                    <h2 className="sa-panel-title">{section.title}</h2>
                    <p className="sa-panel-sub">{section.data.length} record{section.data.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="pd-loading" style={{ minHeight: 80 }}><div className="sa-spinner" /></div>
              ) : (
                <div className="sa-table-wrap" style={{ marginTop: 0 }}>
                  <table className="sa-table">
                    <thead><tr>{section.cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>
                      {section.data.length > 0
                        ? section.data.map(row => section.renderRow(row))
                        : (
                          <tr>
                            <td colSpan={section.cols.length} className="sa-td-empty">
                              <div className="su-empty-state">
                                <Icon name={section.emptyIcon} size={24} />
                                <p>{section.emptyMsg}</p>
                              </div>
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </main>
      </div>
    </div>
  );
};

export default AllRequests;