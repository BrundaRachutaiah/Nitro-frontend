import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../api/axiosInstance";
import {
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser,
  API_BASE_URL,
} from "../../lib/auth";
import "./Dashboard.css";

const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

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
    alert:        <svg {...p}><path d="m10.29 3.86-8.6 14.9A1 1 0 0 0 2.57 20h16.86a1 1 0 0 0 .88-1.24l-8.6-14.9a1 1 0 0 0-1.72 0z"/><path d="M12 9v4M12 17h.01"/></svg>,
    menu:         <svg {...p}><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
    close:        <svg {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>,
    refresh:      <svg {...p}><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
    send:         <svg {...p}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    ticket:       <svg {...p}><path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z"/></svg>,
    open:         <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>,
    check:        <svg {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>,
  };
  return icons[name] || <svg {...p}><circle cx="12" cy="12" r="9"/></svg>;
};

const navItems = [
  { key: "dashboard",      label: "Dashboard",      icon: "dashboard",    path: "/dashboard" },
  { key: "participants",   label: "Participants",    icon: "participants", path: "/super-admin/users" },
  { key: "projects",       label: "Projects",        icon: "projects",     path: "/projects/manage" },
  { key: "approvals",      label: "Approvals",       icon: "approvals",    path: "/admin/applications", badge: true },
  { key: "client_budgets", label: "Client Budgets",  icon: "budgets",      path: "/admin/client-budgets" },
  { key: "payouts",        label: "Payouts",         icon: "payouts",      path: "/admin/payouts" },
  { key: "payout_history", label: "Payout History",  icon: "history",      path: "/admin/payout-history" },
  { key: "reports",        label: "Reports",         icon: "reports",      path: "/super-admin/reports" },
  { key: "support",        label: "Support",         icon: "support",      path: "/super-admin/support" },
];

const statusStyle = (status) => {
  const s = String(status || "").toUpperCase();
  if (s === "OPEN")   return { background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#fcd34d" };
  if (s === "CLOSED") return { background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#6ee7b7" };
  return { background: "rgba(100,116,139,0.12)", border: "1px solid rgba(100,116,139,0.3)", color: "#94a3b8" };
};

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: "1px solid var(--border-light)", background: "var(--bg-3)",
  color: "var(--text)", fontFamily: "Outfit, sans-serif", fontSize: "0.9rem", outline: "none",
};

const Support = () => {
  const navigate = useNavigate();
  const [tickets, setTickets]           = useState([]);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(true);
  const [subject, setSubject]           = useState("");
  const [message, setMessage]           = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [formStatus, setFormStatus]     = useState({ type: "", msg: "" });
  const [user, setUser]                 = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [approvalCounts, setApprovalCounts] = useState({});
  const activeNav = "support";

  const totalApprovals = useMemo(() =>
    toNum(approvalCounts?.participants) +
    toNum(approvalCounts?.product_applications) +
    toNum(approvalCounts?.purchase_proofs) +
    toNum(approvalCounts?.review_submissions),
  [approvalCounts]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) { navigate("/login", { replace: true }); return; }
    let mounted = true;
    (async () => {
      try {
        const me = await verifyBackendUser(token);
        if (mounted) setUser(me);
        const res = await fetch(`${API_BASE_URL}/admin/approvals/count`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        if (mounted) setApprovalCounts(data?.data || {});
      } catch { clearStoredTokens(); navigate("/login", { replace: true }); }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  const loadTickets = async () => {
    setError(""); setLoading(true);
    try {
      const res = await axios.get("/admin/support/tickets");
      setTickets(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load support tickets");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadTickets(); }, []);

  const submitTicket = async (e) => {
    e.preventDefault();
    setFormStatus({ type: "", msg: "" }); setError("");
    if (!subject.trim() || !message.trim()) {
      setFormStatus({ type: "err", msg: "Subject and message are required." }); return;
    }
    setSubmitting(true);
    try {
      await axios.post("/users/support/tickets", { subject: subject.trim(), message: message.trim() });
      setFormStatus({ type: "ok", msg: "Ticket submitted successfully." });
      setSubject(""); setMessage("");
      await loadTickets();
    } catch (err) {
      setFormStatus({ type: "err", msg: err.response?.data?.message || "Failed to submit ticket." });
    } finally { setSubmitting(false); }
  };

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  const handleNavClick = (item) => {
    setIsSidebarOpen(false);
    if (item.path) navigate(item.path);
  };

  const openCount   = tickets.filter(t => String(t.status || "").toUpperCase() === "OPEN").length;
  const closedCount = tickets.filter(t => String(t.status || "").toUpperCase() === "CLOSED").length;

  return (
    <div className="sa-dashboard">
      {/* ══ TOPBAR ══ */}
      <header className="sa-topbar">
        <button type="button" className="sa-menu-btn" onClick={() => setIsSidebarOpen(v => !v)} aria-label="Toggle menu">
          <Icon name={isSidebarOpen ? "close" : "menu"} size={20} />
        </button>
        <div className="sa-brand"><span className="sa-brand-n">N</span>ITRO</div>
        <div style={{ flex: 1 }} />
        <div className="sa-topbar-right">
          {totalApprovals > 0 && (
            <button type="button" className="sa-alert-btn" onClick={() => navigate("/admin/applications")}>
              <Icon name="alert" size={16} /><span>{totalApprovals} pending</span>
            </button>
          )}
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
        {isSidebarOpen && (
          <button type="button" className="sa-backdrop" onClick={() => setIsSidebarOpen(false)} aria-label="Close menu" />
        )}

        {/* ══ SIDEBAR ══ */}
        <aside className={`sa-sidebar ${isSidebarOpen ? "sa-sidebar--open" : ""}`}>
          <nav className="sa-nav">
            {navItems.map(item => (
              <button
                key={item.key}
                type="button"
                className={`sa-nav-item ${activeNav === item.key ? "sa-nav-item--active" : ""}`}
                onClick={() => handleNavClick(item)}
              >
                <span className="sa-nav-icon"><Icon name={item.icon} size={18} /></span>
                <span className="sa-nav-label">{item.label}</span>
                {item.badge && totalApprovals > 0 && (
                  <span className="sa-nav-badge">{totalApprovals}</span>
                )}
              </button>
            ))}
          </nav>
          <button type="button" className="sa-new-project-btn" onClick={() => navigate("/projects/create")}>
            <span>+</span> New Project
          </button>
        </aside>

        {/* ══ MAIN ══ */}
        <main className="sa-main">
          <div className="sa-page-head">
            <div className="sa-page-head-left">
              <h1 className="sa-page-title">Support <span className="sa-highlight">Tickets</span></h1>
              <p className="sa-page-sub">Review and manage user support issues</p>
            </div>
            <div className="sa-page-actions">
              <button type="button" className="sa-export-btn" onClick={loadTickets} disabled={loading}>
                <Icon name="refresh" size={15} /><span>Refresh</span>
              </button>
            </div>
          </div>

          {error && <div className="sa-error"><Icon name="alert" size={16} /> {error}<button type="button" onClick={() => setError("")}>✕</button></div>}

          {/* Stat cards */}
          <div className="sa-cards" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
            <article className="sa-stat-card sa-stat-card--blue">
              <div className="sa-stat-card-top"><div className="sa-stat-icon sa-stat-icon--blue"><Icon name="ticket" size={20} /></div></div>
              <p className="sa-stat-label">Total Tickets</p>
              <div className="sa-stat-value">{tickets.length}</div>
            </article>
            <article className="sa-stat-card sa-stat-card--amber">
              <div className="sa-stat-card-top"><div className="sa-stat-icon sa-stat-icon--amber"><Icon name="open" size={20} /></div><span className="sa-stat-note sa-stat-note--amber">Needs attention</span></div>
              <p className="sa-stat-label">Open Tickets</p>
              <div className="sa-stat-value">{openCount}</div>
            </article>
            <article className="sa-stat-card sa-stat-card--green">
              <div className="sa-stat-card-top"><div className="sa-stat-icon sa-stat-icon--green"><Icon name="check" size={20} /></div><span className="sa-stat-note sa-stat-note--green">Resolved</span></div>
              <p className="sa-stat-label">Closed Tickets</p>
              <div className="sa-stat-value">{closedCount}</div>
            </article>
          </div>

          {/* Raise ticket form */}
          <div className="sa-panel">
            <div className="sa-panel-head">
              <div><h2 className="sa-panel-title">Raise Support Ticket</h2><p className="sa-panel-sub">Submit a new support issue</p></div>
              <Icon name="support" size={18} />
            </div>
            <form onSubmit={submitTicket} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input style={inputStyle} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <textarea style={{ ...inputStyle, minHeight: 110, resize: "vertical" }} placeholder="Describe your issue in detail…" value={message} onChange={(e) => setMessage(e.target.value)} />
              {formStatus.msg && (
                <div className="sa-error" style={formStatus.type === "ok" ? { background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.3)", color: "#6ee7b7" } : {}}>
                  <Icon name={formStatus.type === "ok" ? "check" : "alert"} size={15} /> {formStatus.msg}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" disabled={submitting} style={{
                  display: "flex", alignItems: "center", gap: 8, height: 42, padding: "0 24px",
                  borderRadius: 10, background: "var(--accent)", border: "none", color: "#fff",
                  fontFamily: "Outfit, sans-serif", fontSize: "0.9rem", fontWeight: 600,
                  cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1,
                }}>
                  <Icon name="send" size={15} />{submitting ? "Submitting…" : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>

          {/* Tickets table */}
          <div className="sa-panel sa-panel--table">
            <div className="sa-panel-head">
              <div><h2 className="sa-panel-title">All Tickets</h2><p className="sa-panel-sub">{tickets.length} support tickets</p></div>
            </div>
            <div className="sa-table-wrap">
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 24, color: "var(--text-3)" }}>
                  <div className="sa-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />Loading tickets…
                </div>
              ) : !tickets.length ? (
                <div className="sa-empty-chart"><Icon name="ticket" size={32} /><p>No support tickets found.</p></div>
              ) : (
                <table className="sa-table">
                  <thead><tr><th>Subject</th><th>Status</th><th>User</th><th>Created</th></tr></thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr key={ticket.id}>
                        <td className="sa-td-main">{ticket.subject || "—"}</td>
                        <td><span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", ...statusStyle(ticket.status) }}>{ticket.status || "UNKNOWN"}</span></td>
                        <td className="sa-td-muted">{ticket.profiles?.full_name || ticket.profiles?.email || "—"}</td>
                        <td className="sa-td-muted">{fmtDate(ticket.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Support;