import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { exportBatchesCSV, getBatches } from "../../api/payout.api";
import {
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser,
  API_BASE_URL,
} from "../../lib/auth";
import "../superAdmin/Dashboard.css";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

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
    export:       <svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
    check:        <svg {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>,
    user:         <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
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

const formatAddress = (p) => {
  if (!p) return "—";
  const parts = [p.address_line1, p.address_line2, p.city, p.state, p.pincode, p.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
};
const formatParticipantLabel = (batch) => {
  const rows = Array.isArray(batch?.participants) ? batch.participants : [];
  if (!rows.length) return "—";
  const first = rows[0];
  const label = first?.full_name || first?.email || "—";
  return rows.length === 1 ? label : `${label} +${rows.length - 1} more`;
};

const PayoutHistory = () => {
  const navigate = useNavigate();
  const [rows, setRows]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState("");
  const [user, setUser]               = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [approvalCounts, setApprovalCounts] = useState({});
  const activeNav = "payout_history";

  const totalApprovals = useMemo(() =>
    toNum(approvalCounts?.participants) +
    toNum(approvalCounts?.product_applications) +
    toNum(approvalCounts?.purchase_proofs) +
    toNum(approvalCounts?.review_submissions),
  [approvalCounts]);

  // Load user + approval badge
  useEffect(() => {
    const token = getStoredToken();
    if (!token) { navigate("/login", { replace: true }); return; }
    let mounted = true;
    (async () => {
      try {
        const me = await verifyBackendUser(token);
        if (mounted) setUser(me);
        const res = await fetch(`${API_BASE_URL}/admin/approvals/count`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json().catch(() => ({}));
        if (mounted) setApprovalCounts(data?.data || {});
      } catch { clearStoredTokens(); navigate("/login", { replace: true }); }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  const loadHistory = async () => {
    setLoading(true); setError(""); setSuccess("");
    try {
      const res = await getBatches({ status: "PAID", limit: 500 });
      setRows(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      setRows([]);
      setError(err.response?.data?.message || "Failed to load payout history.");
    } finally { setLoading(false); }
  };

  const handleExportAll = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await exportBatchesCSV({ status: "PAID" });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "payout_history_paid.csv";
      document.body.appendChild(link); link.click(); link.remove();
      window.URL.revokeObjectURL(url);
      setSuccess("Exported successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to export.");
    } finally { setSaving(false); }
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

  useEffect(() => { loadHistory(); }, []);

  const totalPaid = useMemo(() => rows.reduce((s, r) => s + Number(r?.total_amount || 0), 0), [rows]);

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
              <h1 className="sa-page-title">Payout <span className="sa-highlight">History</span></h1>
              <p className="sa-page-sub">All completed payout batches</p>
            </div>
            <div className="sa-page-actions">
              <button type="button" className="sa-export-btn" onClick={() => navigate("/admin/payouts")}>Back to Payouts</button>
              <button type="button" className="sa-export-btn" onClick={loadHistory} disabled={loading}>
                <Icon name="refresh" size={15} /><span>Refresh</span>
              </button>
              <button type="button" className="sa-export-btn" onClick={handleExportAll} disabled={saving || loading || !rows.length}>
                <Icon name="export" size={15} /><span>{saving ? "Exporting…" : "Export Paid CSV"}</span>
              </button>
            </div>
          </div>

          {error && <div className="sa-error"><Icon name="alert" size={16} /> {error}<button type="button" onClick={() => setError("")}>✕</button></div>}
          {success && <div className="sa-error" style={{ background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.3)", color: "#6ee7b7" }}><Icon name="check" size={16} /> {success}<button type="button" onClick={() => setSuccess("")}>✕</button></div>}

          {/* Stat cards */}
          <div className="sa-cards" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
            <article className="sa-stat-card sa-stat-card--green">
              <div className="sa-stat-card-top"><div className="sa-stat-icon sa-stat-icon--green"><Icon name="history" size={20} /></div><span className="sa-stat-note sa-stat-note--green">Completed</span></div>
              <p className="sa-stat-label">Total Batches</p>
              <div className="sa-stat-value">{rows.length}</div>
            </article>
            <article className="sa-stat-card sa-stat-card--cyan">
              <div className="sa-stat-card-top"><div className="sa-stat-icon sa-stat-icon--cyan"><Icon name="payouts" size={20} /></div><span className="sa-stat-note sa-stat-note--cyan">All time</span></div>
              <p className="sa-stat-label">Total Paid Amount</p>
              <div className="sa-stat-value" style={{ fontSize: "1.4rem" }}>{inr.format(totalPaid)}</div>
            </article>
            <article className="sa-stat-card sa-stat-card--blue">
              <div className="sa-stat-card-top"><div className="sa-stat-icon sa-stat-icon--blue"><Icon name="user" size={20} /></div><span className="sa-stat-note sa-stat-note--blue">Per batch</span></div>
              <p className="sa-stat-label">Avg Batch Amount</p>
              <div className="sa-stat-value" style={{ fontSize: "1.4rem" }}>{rows.length ? inr.format(totalPaid / rows.length) : "—"}</div>
            </article>
          </div>

          {/* Table */}
          <div className="sa-panel sa-panel--table">
            <div className="sa-panel-head">
              <div><h2 className="sa-panel-title">Completed Batches</h2><p className="sa-panel-sub">{rows.length} paid payout batches</p></div>
            </div>
            <div className="sa-table-wrap">
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 24, color: "var(--text-3)" }}>
                  <div className="sa-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />Loading payout history…
                </div>
              ) : !rows.length ? (
                <div className="sa-empty-chart"><Icon name="payouts" size={32} /><p>No paid payout batches found.</p></div>
              ) : (
                <table className="sa-table">
                  <thead><tr><th>Batch ID</th><th>Participant</th><th>Account Number</th><th>IFSC</th><th>Address</th><th>Total Amount</th><th>Status</th><th>Created</th></tr></thead>
                  <tbody>
                    {rows.map((batch) => {
                      const pt = Array.isArray(batch?.participants) ? batch.participants[0] : null;
                      return (
                        <tr key={batch.id}>
                          <td className="sa-td-muted" style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{String(batch.id || "").slice(0, 8)}…</td>
                          <td className="sa-td-main">{formatParticipantLabel(batch)}</td>
                          <td className="sa-td-muted">{pt?.bank_account_number || "—"}</td>
                          <td className="sa-td-muted">{pt?.bank_ifsc || "—"}</td>
                          <td className="sa-td-muted" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={formatAddress(pt)}>{formatAddress(pt)}</td>
                          <td className="sa-td-bold">{inr.format(batch.total_amount || 0)}</td>
                          <td><span className="sa-status-badge sa-status-badge--published">PAID</span></td>
                          <td className="sa-td-muted">{fmtDate(batch.created_at)}</td>
                        </tr>
                      );
                    })}
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

export default PayoutHistory;