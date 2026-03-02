import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getParticipantById } from "../../api/admin.api";
import {
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser,
} from "../../lib/auth";
import "./Dashboard.css";

/* ─── Formatters ── */
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const fmtCurrency = (v) => inr.format(Number(v || 0));
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const BANK_FIELDS = [
  "bank_account_name", "bank_account_number", "bank_ifsc",
  "bank_name", "upi_id", "account_holder_name", "account_number", "ifsc_code",
];

/* ─── SVG Icons ── */
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
    refresh:      <svg {...p}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
    arrow:        <svg {...p}><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
    arrowLeft:    <svg {...p}><path d="M19 12H5M12 5l-7 7 7 7"/></svg>,
    user:         <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    bank:         <svg {...p}><path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l9 5H3z"/></svg>,
    check:        <svg {...p}><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>,
    link:         <svg {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    mail:         <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
    phone:        <svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.05 3.4 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 8.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16l.92.92z"/></svg>,
    calendar:     <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>,
    shield:       <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    tag:          <svg {...p}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  };
  return icons[name] || <svg {...p}><circle cx="12" cy="12" r="9"/></svg>;
};

/* ─── Nav items ── */
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

/* ─── Status badge ── */
const StatusBadge = ({ status, size = "md" }) => {
  const s = String(status || "").toUpperCase();
  const map = {
    APPROVED:      { cls: "sa-status-badge--published", label: "Approved" },
    PENDING:       { cls: "sa-status-badge--pending",   label: "Pending" },
    REJECTED:      { cls: "sa-status-badge--rejected",  label: "Rejected" },
    COMPLETED:     { cls: "sa-status-badge--published", label: "Completed" },
    PAID:          { cls: "sa-status-badge--published", label: "Paid" },
    ELIGIBLE:      { cls: "sa-status-badge--pending",   label: "Eligible" },
    NOT_ELIGIBLE:  { cls: "sa-status-badge--draft",     label: "Not Eligible" },
    PURCHASED:     { cls: "sa-status-badge--mode-d2c",  label: "Purchased" },
  };
  const { cls, label } = map[s] || { cls: "sa-status-badge--draft", label: status || "—" };
  return <span className={`sa-status-badge ${cls} ${size === "sm" ? "sa-status-badge--sm" : ""}`}>{label}</span>;
};

/* ═══════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════ */
const ParticipantDetails = () => {
  const navigate = useNavigate();
  const { participantId } = useParams();

  const [user, setUser]         = useState(null);
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  /* ── Auth ── */
  useEffect(() => {
    const init = async () => {
      const token = getStoredToken();
      if (!token) { navigate("/login", { replace: true }); return; }
      try { const me = await verifyBackendUser(token); setUser(me); }
      catch { navigate("/login", { replace: true }); }
    };
    init();
  }, [navigate]);

  /* ── Load participant ── */
  const loadDetails = useCallback(async () => {
    setError(""); setLoading(true);
    try {
      const res = await getParticipantById(participantId);
      setData(res?.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load participant details.");
    } finally { setLoading(false); }
  }, [participantId]);

  useEffect(() => { loadDetails(); }, [loadDetails]);

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  /* ── Derived data ── */
  const bankRows = useMemo(() => {
    if (!data) return [];
    return BANK_FIELDS.map((key) => ({
      key,
      label: key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: data[key],
    })).filter((r) => r.value);
  }, [data]);

  const completedProducts = Array.isArray(data?.completed_products) ? data.completed_products : [];
  const summary = data?.summary || {};

  const statCards = [
    { title: "Approved Applications", value: summary.approved_applications || 0,    icon: "approvals",    tone: "blue" },
    { title: "Approved Proofs",       value: summary.approved_purchase_proofs || 0, icon: "check",        tone: "cyan" },
    { title: "Approved Reviews",      value: summary.approved_reviews || 0,         icon: "tag",          tone: "green" },
    { title: "Eligible Payouts",      value: summary.payouts_eligible || 0,         icon: "payouts",      tone: "amber" },
    { title: "Payouts Paid",          value: summary.payouts_paid || 0,             icon: "shield",       tone: "green" },
  ];

  /* ── Display name initial ── */
  const initial = String(data?.full_name || data?.email || "P")[0].toUpperCase();
  const statusColor = {
    APPROVED: "var(--green)", PENDING: "var(--amber)", REJECTED: "var(--danger)",
  }[String(data?.status || "").toUpperCase()] || "var(--text-3)";

  return (
    <div className="sa-dashboard">

      {/* ══ TOPBAR ══ */}
      <header className="sa-topbar">
        <button type="button" className="sa-menu-btn" onClick={() => setIsSidebarOpen(v => !v)} aria-label="Toggle menu">
          <Icon name={isSidebarOpen ? "close" : "menu"} size={20} />
        </button>
        <div className="sa-brand"><span className="sa-brand-n">N</span>ITRO</div>

        <div className="sa-topbar-right" style={{ marginLeft: "auto" }}>
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
              <div className="pd-breadcrumb">
                <button type="button" className="pd-breadcrumb-link" onClick={() => navigate("/super-admin/users")}>
                  Participants
                </button>
                <span className="pd-breadcrumb-sep">/</span>
                <span>Details</span>
              </div>
              <h1 className="sa-page-title">
                Participant <span className="sa-highlight">Details</span>
              </h1>
              <p className="sa-page-sub">Profile, bank details, and completed product purchase journey</p>
            </div>
            <div className="sa-page-actions">
              <button type="button" className="sa-export-btn" onClick={() => navigate("/super-admin/users")}>
                <Icon name="arrowLeft" size={16} />
                <span>Back</span>
              </button>
              <button type="button" className="sa-export-btn" onClick={loadDetails} disabled={loading}>
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

          {/* ── Loading ── */}
          {loading && (
            <div className="sa-panel pd-loading">
              <div className="sa-spinner" />
              <p>Loading participant details…</p>
            </div>
          )}

          {!loading && data && (
            <>
              {/* ── Profile hero card ── */}
              <div className="pd-hero-grid">

                {/* Profile */}
                <div className="sa-panel pd-profile-card">
                  <div className="sa-panel-head">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Icon name="user" size={18} />
                      <h2 className="sa-panel-title" style={{ margin: 0 }}>Profile Information</h2>
                    </div>
                    <StatusBadge status={data?.status} />
                  </div>

                  {/* Large avatar + name */}
                  <div className="pd-profile-hero">
                    <div className="pd-profile-avatar" style={{ borderColor: statusColor }}>
                      {initial}
                    </div>
                    <div className="pd-profile-name-block">
                      <h3 className="pd-profile-name">{data?.full_name || "—"}</h3>
                      <span className="pd-profile-id">ID: {participantId?.slice(0, 8)}…</span>
                    </div>
                  </div>

                  <div className="pd-info-grid">
                    <div className="pd-info-row">
                      <span className="pd-info-icon"><Icon name="mail" size={14} /></span>
                      <div>
                        <span className="pd-info-label">Email</span>
                        <span className="pd-info-value">{data?.email || "—"}</span>
                      </div>
                    </div>
                    <div className="pd-info-row">
                      <span className="pd-info-icon"><Icon name="phone" size={14} /></span>
                      <div>
                        <span className="pd-info-label">Phone</span>
                        <span className="pd-info-value">{data?.phone || "—"}</span>
                      </div>
                    </div>
                    <div className="pd-info-row">
                      <span className="pd-info-icon"><Icon name="shield" size={14} /></span>
                      <div>
                        <span className="pd-info-label">Status</span>
                        <span className="pd-info-value" style={{ color: statusColor }}>
                          {data?.status || "—"}
                        </span>
                      </div>
                    </div>
                    <div className="pd-info-row">
                      <span className="pd-info-icon"><Icon name="calendar" size={14} /></span>
                      <div>
                        <span className="pd-info-label">Joined</span>
                        <span className="pd-info-value">{fmtDateTime(data?.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bank Details */}
                <div className="sa-panel pd-bank-card">
                  <div className="sa-panel-head">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Icon name="bank" size={18} />
                      <h2 className="sa-panel-title" style={{ margin: 0 }}>Bank Details</h2>
                    </div>
                  </div>

                  {bankRows.length > 0 ? (
                    <div className="pd-bank-grid">
                      {bankRows.map((row) => (
                        <div key={row.key} className="pd-bank-row">
                          <span className="pd-info-label">{row.label}</span>
                          <span className="pd-bank-value">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="pd-bank-empty">
                      <Icon name="bank" size={32} />
                      <p>No bank details added by participant yet.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Summary stat cards ── */}
              <div className="sa-cards" style={{ gridTemplateColumns: "repeat(5, minmax(0,1fr))" }}>
                {statCards.map((card, i) => (
                  <article
                    key={card.title}
                    className={`sa-stat-card sa-stat-card--${card.tone}`}
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <div className="sa-stat-card-top">
                      <div className={`sa-stat-icon sa-stat-icon--${card.tone}`}>
                        <Icon name={card.icon} size={18} />
                      </div>
                    </div>
                    <p className="sa-stat-label">{card.title}</p>
                    <div className="sa-stat-value">{card.value}</div>
                  </article>
                ))}
              </div>

              {/* ── Completed Product Journey table ── */}
              <div className="sa-panel sa-panel--table">
                <div className="sa-panel-head">
                  <div>
                    <h2 className="sa-panel-title">Completed Product Journey</h2>
                    <p className="sa-panel-sub">
                      {completedProducts.length} completed record{completedProducts.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Icon name="arrow" size={18} />
                </div>

                <div className="sa-table-wrap" style={{ marginTop: 0 }}>
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Product</th>
                        <th>Mode</th>
                        <th>Allocation</th>
                        <th>Purchase Proof</th>
                        <th>Review</th>
                        <th>Payout</th>
                        <th>Expected</th>
                        <th>Actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedProducts.length > 0 ? (
                        completedProducts.map((row) => (
                          <tr key={row.application_id} className="sa-table-row--clickable">
                            <td className="sa-td-main">{row.project_name || "—"}</td>
                            <td className="sa-td-muted">{row.product_name || "—"}</td>
                            <td>
                              <span className={`sa-mode-badge sa-mode-badge--${String(row.project_mode || "").toLowerCase()}`}>
                                {row.project_mode || "—"}
                              </span>
                            </td>
                            <td><StatusBadge status={row.allocation_status} size="sm" /></td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <StatusBadge status={row.purchase_proof_status} size="sm" />
                                {row.purchase_proof_url && (
                                  <a
                                    href={row.purchase_proof_url}
                                    target="_blank" rel="noreferrer"
                                    className="pd-ext-link"
                                  >
                                    <Icon name="link" size={11} /> View proof
                                  </a>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <StatusBadge status={row.review_status} size="sm" />
                                {row.review_url && (
                                  <a
                                    href={row.review_url}
                                    target="_blank" rel="noreferrer"
                                    className="pd-ext-link"
                                  >
                                    <Icon name="link" size={11} /> View review
                                  </a>
                                )}
                              </div>
                            </td>
                            <td><StatusBadge status={row.payout_status || "NOT_ELIGIBLE"} size="sm" /></td>
                            <td className="sa-td-bold">{fmtCurrency(row.expected_payout_amount)}</td>
                            <td className="sa-td-bold" style={{ color: "var(--green)" }}>
                              {fmtCurrency(row.payout_amount)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="sa-td-empty">
                            <div className="su-empty-state">
                              <Icon name="reports" size={28} />
                              <p>No completed product journey found for this participant.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </main>
      </div>
    </div>
  );
};

export default ParticipantDetails;