import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { approveParticipant, getAllParticipants, rejectParticipant } from "../../api/admin.api";
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
    filter:       <svg {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
    check:        <svg {...p}><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>,
    x:            <svg {...p}><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>,
    mail:         <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
    login:        <svg {...p}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>,
    search:       <svg {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>,
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

const STATUS_FILTERS = ["PENDING", "APPROVED", "REJECTED", "ALL"];

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

const fmtDate = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const LoginRequests = () => {
  const navigate = useNavigate();
  const [user, setUser]             = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [rows, setRows]             = useState([]);
  const [workingId, setWorkingId]   = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [search, setSearch]         = useState("");
  const [confirmModal, setConfirmModal] = useState(null); // { action, id, name }

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
      const res = await getAllParticipants();
      const all = Array.isArray(res?.data?.data) ? res.data.data : [];
      setRows(statusFilter === "ALL" ? all : all.filter(r => String(r?.status || "").toUpperCase() === statusFilter));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load login requests.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  const onApprove = async (id) => {
    setWorkingId(`approve-${id}`); setError("");
    try { await approveParticipant(id); await load(); }
    catch (err) { setError(err.response?.data?.message || "Unable to approve participant."); }
    finally { setWorkingId(""); setConfirmModal(null); }
  };

  const onReject = async (id) => {
    setWorkingId(`reject-${id}`); setError("");
    try { await rejectParticipant(id); await load(); }
    catch (err) { setError(err.response?.data?.message || "Unable to reject participant."); }
    finally { setWorkingId(""); setConfirmModal(null); }
  };

  const filtered = rows.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (r.full_name || "").toLowerCase().includes(q) || (r.email || "").toLowerCase().includes(q);
  });

  const counts = {
    PENDING:  rows.filter(r => String(r.status || "").toUpperCase() === "PENDING").length,
    APPROVED: rows.filter(r => String(r.status || "").toUpperCase() === "APPROVED").length,
    REJECTED: rows.filter(r => String(r.status || "").toUpperCase() === "REJECTED").length,
  };

  return (
    <div className="sa-dashboard">
      {/* ── Confirm Modal ── */}
      {confirmModal && (
        <div className="su-modal-overlay">
          <div className="su-modal">
            <div className="su-modal-icon"><Icon name="alert" size={22} /></div>
            <h3 className="su-modal-title">Confirm {confirmModal.action === "approve" ? "Approval" : "Rejection"}</h3>
            <p className="su-modal-body">
              Are you sure you want to <strong>{confirmModal.action}</strong> the login request for <strong>{confirmModal.name}</strong>?
            </p>
            <div className="su-modal-actions">
              <button type="button" className="su-action-btn su-action-btn--ghost" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button type="button"
                className={`su-action-btn ${confirmModal.action === "approve" ? "su-action-btn--approve" : "su-action-btn--reject"}`}
                disabled={!!workingId}
                onClick={() => confirmModal.action === "approve" ? onApprove(confirmModal.id) : onReject(confirmModal.id)}>
                {workingId ? "Working…" : confirmModal.action === "approve" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="sa-topbar">
        <button type="button" className="sa-menu-btn" onClick={() => setIsSidebarOpen(v => !v)}>
          <Icon name={isSidebarOpen ? "close" : "menu"} size={20} />
        </button>
        <div className="sa-brand"><span className="sa-brand-n">N</span>ITRO</div>

        <div className="sa-search-wrap">
          <span className="sa-search-icon"><Icon name="search" size={16} /></span>
          <input type="text" className="sa-search" placeholder="Search by name or email…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="sa-topbar-right">
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
                <span>Login Requests</span>
              </div>
              <h1 className="sa-page-title">Login <span className="sa-highlight">Requests</span></h1>
              <p className="sa-page-sub">Pending participant registration approvals</p>
            </div>
            <div className="sa-page-actions">
              <button type="button" className="sa-export-btn" onClick={() => navigate("/admin/applications")}>
                <Icon name="arrowLeft" size={16} /><span>Back</span>
              </button>
              <button type="button" className="sa-export-btn" onClick={load} disabled={loading}>
                <Icon name="refresh" size={16} /><span>{loading ? "Loading…" : "Refresh"}</span>
              </button>
            </div>
          </div>

          {error && <div className="sa-error"><Icon name="alert" size={16} /> {error}<button type="button" onClick={() => setError("")}>✕</button></div>}

          {/* Status filter tabs */}
          <div className="app-tab-bar">
            {STATUS_FILTERS.map(f => (
              <button key={f} type="button"
                className={`app-tab ${statusFilter === f ? "app-tab--active" : ""}`}
                onClick={() => setStatusFilter(f)}>
                {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                {f !== "ALL" && counts[f] !== undefined && (
                  <span className="app-tab-count">{counts[f]}</span>
                )}
              </button>
            ))}
            <span className="su-result-count" style={{ marginLeft: "auto" }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Table */}
          <div className="sa-panel sa-panel--table">
            {loading ? (
              <div className="pd-loading"><div className="sa-spinner" /><p>Loading login requests…</p></div>
            ) : (
              <div className="sa-table-wrap" style={{ marginTop: 0 }}>
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Requested At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length > 0 ? (
                      filtered.map(row => (
                        <tr key={row.id} className="sa-table-row--clickable">
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div className="su-user-avatar-sm">{String(row.full_name || row.email || "?")[0].toUpperCase()}</div>
                              <span className="sa-td-main">{row.full_name || "—"}</span>
                            </div>
                          </td>
                          <td className="sa-td-muted">
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <Icon name="mail" size={13} /> {row.email || "—"}
                            </span>
                          </td>
                          <td><StatusBadge status={row.status || "PENDING"} /></td>
                          <td className="sa-td-muted">{fmtDate(row.created_at)}</td>
                          <td>
                            {String(row?.status || "").toUpperCase() === "PENDING" ? (
                              <div style={{ display: "flex", gap: 6 }}>
                                <button type="button" className="su-action-btn su-action-btn--approve"
                                  disabled={workingId === `approve-${row.id}`}
                                  onClick={() => setConfirmModal({ action: "approve", id: row.id, name: row.full_name || row.email })}>
                                  <Icon name="check" size={13} /> Approve
                                </button>
                                <button type="button" className="su-action-btn su-action-btn--reject"
                                  disabled={workingId === `reject-${row.id}`}
                                  onClick={() => setConfirmModal({ action: "reject", id: row.id, name: row.full_name || row.email })}>
                                  <Icon name="x" size={13} /> Reject
                                </button>
                              </div>
                            ) : <span className="sa-td-muted">—</span>}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="sa-td-empty">
                          <div className="su-empty-state">
                            <Icon name="login" size={28} />
                            <p>No login requests for selected status.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default LoginRequests;