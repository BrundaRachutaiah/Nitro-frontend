import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../api/axiosInstance";
import { getStoredToken, verifyBackendUser, clearStoredTokens, signOutFromSupabase } from "../../lib/auth";
import "./Dashboard.css";

/* ─── Formatters ── */
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

/* ─── SVG Icons (same as Dashboard) ── */
const Icon = ({ name, size = 18 }) => {
  const p = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round",
    strokeLinejoin: "round", "aria-hidden": true,
  };
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
    search:       <svg {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>,
    menu:         <svg {...p}><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
    close:        <svg {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>,
    alert:        <svg {...p}><path d="m10.29 3.86-8.6 14.9A1 1 0 0 0 2.57 20h16.86a1 1 0 0 0 .88-1.24l-8.6-14.9a1 1 0 0 0-1.72 0z"/><path d="M12 9v4M12 17h.01"/></svg>,
    check:        <svg {...p}><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>,
    trash:        <svg {...p}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    eye:          <svg {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    star:         <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    shield:       <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    shieldOff:    <svg {...p}><path d="M19.69 14a6.9 6.9 0 0 0 .31-2V5l-8-3-3.16 1.18M4.73 4.73 4 5v7c0 6 8 10 8 10a20.29 20.29 0 0 0 5.62-4.38M2 2l20 20"/></svg>,
    refresh:      <svg {...p}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
    arrow:        <svg {...p}><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
    filter:       <svg {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
    userPlus:     <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  };
  return icons[name] || <svg {...p}><circle cx="12" cy="12" r="9"/></svg>;
};

/* ─── Nav items (same as Dashboard) ── */
const NAV_ITEMS = [
  { key: "dashboard",      label: "Dashboard",       icon: "dashboard",    path: "/dashboard" },
  { key: "participants",   label: "Participants",     icon: "participants", path: "/super-admin/users" },
  { key: "projects",       label: "Projects",         icon: "projects",     path: "/projects/manage" },
  { key: "approvals",      label: "Approvals",        icon: "approvals",    path: "/admin/applications" },
  { key: "client_budgets", label: "Client Budgets",   icon: "budgets",      path: "/admin/client-budgets" },
  { key: "payouts",        label: "Payouts",          icon: "payouts",      path: "/admin/payouts" },
  { key: "payout_history", label: "Payout History",   icon: "history",      path: "/admin/payout-history" },
  { key: "reports",        label: "Reports",          icon: "reports",      path: "/super-admin/reports" },
  { key: "support",        label: "Support",          icon: "support",      path: "/super-admin/support" },
];

/* ─── Status badge component ── */
const StatusBadge = ({ status }) => {
  const s = String(status || "").toUpperCase();
  const map = {
    APPROVED: { cls: "sa-status-badge--published", label: "Approved" },
    PENDING:  { cls: "sa-status-badge--pending",   label: "Pending" },
    REJECTED: { cls: "sa-status-badge--rejected",  label: "Rejected" },
  };
  const { cls, label } = map[s] || { cls: "sa-status-badge--draft", label: status || "Unknown" };
  return <span className={`sa-status-badge ${cls}`}>{label}</span>;
};

/* ─── Confirm modal ── */
const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <div className="su-modal-overlay">
    <div className="su-modal">
      <div className="su-modal-icon"><Icon name="alert" size={28} /></div>
      <p className="su-modal-msg" style={{ whiteSpace: "pre-line" }}>{message}</p>
      <div className="su-modal-actions">
        <button type="button" className="sa-date-cancel" onClick={onCancel}>Cancel</button>
        <button type="button" className="su-confirm-btn" onClick={onConfirm}>Confirm</button>
      </div>
    </div>
  </div>
);

/* ════════════════════════════════════════════
   MAIN — Users / Participants Page
════════════════════════════════════════════ */
const Users = () => {
  const navigate = useNavigate();
  const [user, setUser]               = useState(null);
  const [participants, setParticipants] = useState([]);
  const [admins, setAdmins]           = useState([]);
  const [superAdmins, setSuperAdmins] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [activeTab, setActiveTab]     = useState("participants");
  const [searchTerm, setSearchTerm]   = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [confirm, setConfirm]         = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  /* ── Load all 3 role groups ── */
  const loadUsers = async () => {
    setError(""); setLoading(true);
    try {
      const reqs = [axios.get("/admin/participants")];
      if (isSuperAdmin) {
        reqs.push(axios.get("/admin/admins"));
        reqs.push(axios.get("/admin/super-admins"));
      }
      const [pRes, aRes, saRes] = await Promise.all(reqs);
      setParticipants(Array.isArray(pRes.data?.data) ? pRes.data.data : []);
      setAdmins(Array.isArray(aRes?.data?.data) ? aRes.data.data : []);
      setSuperAdmins(Array.isArray(saRes?.data?.data) ? saRes.data.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load users");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const init = async () => {
      const token = getStoredToken();
      if (!token) { navigate("/login", { replace: true }); return; }
      try {
        const me = await verifyBackendUser(token);
        setUser(me);
        const role = String(me?.role || "").toUpperCase();
        setIsSuperAdmin(role === "SUPER_ADMIN");
      } catch { navigate("/login", { replace: true }); }
    };
    init();
  }, [navigate]);

  useEffect(() => { loadUsers(); }, [isSuperAdmin]);

  /* ── Actions ── */
  const runAction = async (label, fn) => {
    setActionLoading(label);
    try { await fn(); await loadUsers(); }
    catch (err) { setError(err.response?.data?.message || `Failed: ${label}`); }
    finally { setActionLoading(null); setConfirm(null); }
  };

  const confirmAction = (message, fn) => setConfirm({ message, onConfirm: () => runAction(message, fn) });

  const updateStatus      = (id, action)  => runAction(action, () => axios.patch(`/admin/participants/${id}/${action}`));
  const deleteUser        = (id)          => confirmAction("Delete this participant permanently?", () => axios.delete(`/admin/participants/${id}`));
  const promoteAdmin      = (id, name)    => confirmAction(`Promote ${name || "this user"} to Admin?\nThey will have admin-level access to the platform.`, () => axios.patch(`/admin/participants/${id}/promote-admin`));
  const promoteSuper      = (id, name)    => confirmAction(`Promote ${name || "this user"} to Super Admin?\nThis grants full platform access including user management.`, () => axios.patch(`/admin/participants/${id}/promote-super-admin`));
  const removeAdmin       = (id, name)    => confirmAction(`Remove admin access from ${name || "this user"}?\nThey will become a Participant.`, () => axios.patch(`/admin/admins/${id}/remove-access`));
  const demoteSuper       = (id, name)    => confirmAction(`Demote ${name || "this user"} from Super Admin to Admin?`, () => axios.patch(`/admin/super-admins/${id}/demote`));

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  /* ── Filtered data ── */
  const currentList = activeTab === "admins" ? admins : activeTab === "superadmins" ? superAdmins : participants;
  const filteredList = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return currentList.filter((u) => {
      const matchSearch = !term
        || String(u.full_name || "").toLowerCase().includes(term)
        || String(u.email || "").toLowerCase().includes(term);
      const matchStatus = statusFilter === "ALL" || String(u.status || "").toUpperCase() === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [currentList, searchTerm, statusFilter]);

  /* ── Stats for summary cards ── */
  const stats = useMemo(() => ({
    total:       participants.length,
    approved:    participants.filter(u => String(u.status||"").toUpperCase() === "APPROVED").length,
    pending:     participants.filter(u => String(u.status||"").toUpperCase() === "PENDING").length,
    admins:      admins.length,
    superAdmins: superAdmins.length,
  }), [participants, admins, superAdmins]);

  return (
    <div className="sa-dashboard">

      {/* ══ TOPBAR ══ */}
      <header className="sa-topbar">
        <button type="button" className="sa-menu-btn" onClick={() => setIsSidebarOpen(v => !v)} aria-label="Toggle menu">
          <Icon name={isSidebarOpen ? "close" : "menu"} size={20} />
        </button>
        <div className="sa-brand"><span className="sa-brand-n">N</span>ITRO</div>

        <div className="sa-search-wrap">
          <span className="sa-search-icon"><Icon name="search" size={16} /></span>
          <input
            type="text"
            className="sa-search"
            placeholder="Search by name or email…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="sa-topbar-right">
          {stats.pending > 0 && (
            <button type="button" className="sa-alert-btn" onClick={() => setStatusFilter("PENDING")}>
              <Icon name="alert" size={16} />
              <span>{stats.pending} pending</span>
            </button>
          )}
          <div className="sa-user-pill">
            <div className="sa-user-avatar">
              {String(user?.full_name || user?.email || "A")[0].toUpperCase()}
            </div>
            <div className="sa-user-info">
              <span className="sa-user-name">{user?.full_name || user?.email || "Admin"}</span>
              <span className="sa-user-role">{user?.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</span>
            </div>
          </div>
          <button type="button" className="sa-logout" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="sa-layout">
        {/* ══ SIDEBAR ══ */}
        {isSidebarOpen && (
          <button type="button" className="sa-backdrop" onClick={() => setIsSidebarOpen(false)} aria-label="Close menu" />
        )}
        <aside className={`sa-sidebar ${isSidebarOpen ? "sa-sidebar--open" : ""}`}>
          <nav className="sa-nav">
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                type="button"
                className={`sa-nav-item ${item.key === "participants" ? "sa-nav-item--active" : ""}`}
                onClick={() => { setIsSidebarOpen(false); navigate(item.path); }}
              >
                <span className="sa-nav-icon"><Icon name={item.icon} size={18} /></span>
                <span className="sa-nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
          <button type="button" className="sa-new-project-btn" onClick={() => navigate("/projects/manage")}>
            <span>+</span> New Project
          </button>
        </aside>

        {/* ══ MAIN ══ */}
        <main className="sa-main">

          {/* ── Page header ── */}
          <div className="sa-page-head">
            <div className="sa-page-head-left">
              <h1 className="sa-page-title">
                <span className="sa-highlight">Participants</span> & Admins
              </h1>
              <p className="sa-page-sub">Approve and manage user access to the platform</p>
            </div>
            <div className="sa-page-actions">
              <button type="button" className="sa-export-btn" onClick={loadUsers} disabled={loading}>
                <Icon name="refresh" size={16} />
                <span>{loading ? "Loading…" : "Refresh"}</span>
              </button>
            </div>
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="sa-error">
              <Icon name="alert" size={16} /> {error}
              <button type="button" onClick={() => setError("")}>✕</button>
            </div>
          )}

          {/* ── Stat Cards ── */}
          <div className="sa-cards">
            {[
              { title: "Total Participants", value: stats.total,       note: "All registered",       icon: "participants", tone: "blue" },
              { title: "Approved",           value: stats.approved,    note: "Active members",       icon: "check",        tone: "green" },
              { title: "Pending Approval",   value: stats.pending,     note: "Awaiting review",      icon: "alert",        tone: stats.pending > 0 ? "amber" : "blue" },
              { title: "Admins",             value: stats.admins,      note: "With admin access",    icon: "shield",       tone: "cyan" },
              { title: "Super Admins",       value: stats.superAdmins, note: "Full platform access", icon: "star",         tone: "indigo" },
            ].map((card, i) => (
              <article
                key={card.title}
                className={`sa-stat-card sa-stat-card--${card.tone}`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="sa-stat-card-top">
                  <div className={`sa-stat-icon sa-stat-icon--${card.tone}`}>
                    <Icon name={card.icon} size={20} />
                  </div>
                  <span className={`sa-stat-note sa-stat-note--${card.tone}`}>{card.note}</span>
                </div>
                <p className="sa-stat-label">{card.title}</p>
                <div className="sa-stat-value">{card.value}</div>
              </article>
            ))}
          </div>

          {/* ── Panel ── */}
          <div className="sa-panel">

            {/* Panel head with tabs + filter */}
            <div className="su-panel-controls">
              <div className="su-tabs">
                <button
                  type="button"
                  className={`su-tab ${activeTab === "participants" ? "su-tab--active" : ""}`}
                  onClick={() => { setActiveTab("participants"); setStatusFilter("ALL"); }}
                >
                  <Icon name="participants" size={15} />
                  Participants
                  {participants.length > 0 && <span className="su-tab-count">{participants.length}</span>}
                </button>
                {isSuperAdmin && (
                  <button
                    type="button"
                    className={`su-tab ${activeTab === "admins" ? "su-tab--active" : ""}`}
                    onClick={() => { setActiveTab("admins"); setStatusFilter("ALL"); }}
                  >
                    <Icon name="shield" size={15} />
                    Admins
                    {admins.length > 0 && <span className="su-tab-count">{admins.length}</span>}
                  </button>
                )}
                {isSuperAdmin && (
                  <button
                    type="button"
                    className={`su-tab ${activeTab === "superadmins" ? "su-tab--active" : ""}`}
                    onClick={() => { setActiveTab("superadmins"); setStatusFilter("ALL"); }}
                  >
                    <Icon name="star" size={15} />
                    Super Admins
                    {superAdmins.length > 0 && <span className="su-tab-count su-tab-count--super">{superAdmins.length}</span>}
                  </button>
                )}
              </div>

              {activeTab === "participants" && (
                <div className="su-filter-row">
                  <Icon name="filter" size={14} />
                  {["ALL", "APPROVED", "PENDING", "REJECTED"].map(s => (
                    <button
                      key={s}
                      type="button"
                      className={`su-filter-btn ${statusFilter === s ? "su-filter-btn--active" : ""}`}
                      onClick={() => setStatusFilter(s)}
                    >
                      {s === "ALL" ? "All" : s[0] + s.slice(1).toLowerCase()}
                    </button>
                  ))}
                  <span className="su-result-count">{filteredList.length} result{filteredList.length !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>

            {/* ── Table ── */}
            <div className="sa-table-wrap" style={{ marginTop: 0 }}>
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="sa-td-empty">
                      <div className="su-loading-row">
                        <div className="su-mini-spinner" />
                        Loading…
                      </div>
                    </td></tr>
                  ) : filteredList.length === 0 ? (
                    <tr><td colSpan={5} className="sa-td-empty">
                      <div className="su-empty-state">
                        <Icon name="participants" size={32} />
                        <p>No {activeTab} found{searchTerm ? ` matching "${searchTerm}"` : ""}.</p>
                      </div>
                    </td></tr>
                  ) : (
                    filteredList.map((u) => {
                      const status = String(u.status || "").toUpperCase();
                      return (
                        <tr key={u.id} className="sa-table-row--clickable">
                          {/* Name */}
                          <td>
                            <div className="su-user-cell">
                              <div className="su-avatar">
                                {String(u.full_name || u.email || "?")[0].toUpperCase()}
                              </div>
                              <span className="sa-td-main">{u.full_name || "—"}</span>
                            </div>
                          </td>
                          {/* Email */}
                          <td className="sa-td-muted">{u.email || "—"}</td>
                          {/* Status */}
                          <td><StatusBadge status={u.status} /></td>
                          {/* Date */}
                          <td className="sa-td-muted">{fmtDate(u.created_at)}</td>
                          {/* Actions */}
                          <td>
                            <div className="su-action-row">
                              {/* View Details */}
                              {isSuperAdmin && activeTab === "participants" && (
                                <button
                                  type="button"
                                  className="su-action-btn su-action-btn--ghost"
                                  title="View Details"
                                  onClick={() => navigate(`/super-admin/participants/${u.id}`)}
                                >
                                  <Icon name="eye" size={14} />
                                  <span>View</span>
                                </button>
                              )}
                              {/* Approve (Pending only) */}
                              {status === "PENDING" && (
                                <button
                                  type="button"
                                  className="su-action-btn su-action-btn--approve"
                                  disabled={actionLoading !== null}
                                  onClick={() => updateStatus(u.id, "approve")}
                                >
                                  <Icon name="check" size={14} />
                                  <span>Approve</span>
                                </button>
                              )}
                              {/* Reject (Pending + Approved) */}
                              {(status === "PENDING" || status === "APPROVED") && (
                                <button
                                  type="button"
                                  className="su-action-btn su-action-btn--reject"
                                  disabled={actionLoading !== null}
                                  onClick={() => confirmAction(`Reject ${u.full_name || "this user"}?`, () => axios.patch(`/admin/participants/${u.id}/reject`))}
                                >
                                  <Icon name="close" size={14} />
                                  <span>Reject</span>
                                </button>
                              )}
                              {/* Delete (Rejected) */}
                              {status === "REJECTED" && (
                                <button
                                  type="button"
                                  className="su-action-btn su-action-btn--danger"
                                  disabled={actionLoading !== null}
                                  onClick={() => deleteUser(u.id)}
                                >
                                  <Icon name="trash" size={14} />
                                  <span>Delete</span>
                                </button>
                              )}
                              {/* Promote role — Super Admin only, Approved participants */}
                              {isSuperAdmin && activeTab === "participants" && status === "APPROVED" && (
                                <>
                                  <button
                                    type="button"
                                    className="su-action-btn su-action-btn--promote"
                                    disabled={actionLoading !== null}
                                    title="Grant admin-level access"
                                    onClick={() => promoteAdmin(u.id, u.full_name)}
                                  >
                                    <Icon name="star" size={14} />
                                    <span>Make Admin</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="su-action-btn su-action-btn--super"
                                    disabled={actionLoading !== null}
                                    title="Grant full super admin access"
                                    onClick={() => promoteSuper(u.id, u.full_name)}
                                  >
                                    <Icon name="shield" size={14} />
                                    <span>Make Super Admin</span>
                                  </button>
                                </>
                              )}
                              {/* Admins tab — remove access → demotes to Participant */}
                              {activeTab === "admins" && (
                                <button
                                  type="button"
                                  className="su-action-btn su-action-btn--danger"
                                  disabled={actionLoading !== null}
                                  onClick={() => removeAdmin(u.id, u.full_name)}
                                >
                                  <Icon name="shieldOff" size={14} />
                                  <span>Remove Access</span>
                                </button>
                              )}
                              {/* Super Admins tab — demote to Admin */}
                              {activeTab === "superadmins" && (
                                <button
                                  type="button"
                                  className="su-action-btn su-action-btn--reject"
                                  disabled={actionLoading !== null}
                                  title="Demote to Admin role"
                                  onClick={() => demoteSuper(u.id, u.full_name)}
                                >
                                  <Icon name="shieldOff" size={14} />
                                  <span>Demote to Admin</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </main>
      </div>

      {/* ── Confirm Modal ── */}
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default Users;