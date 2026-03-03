import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProofReview from "../../components/verification/ProofPreview";
import ApproveRejectionButton from "../../components/verification/ApproveRejectButtons";
import axios from "../../api/axiosInstance";
import {
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser,
  API_BASE_URL,
} from "../../lib/auth";
import "../superAdmin/Dashboard.css";

const VALID_UPLOAD_TYPES = new Set(["ALL", "INVOICE", "REVIEW"]);
const VALID_STATUSES     = new Set(["ALL", "PENDING", "APPROVED", "REJECTED"]);
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const readQueryFilters = (search) => {
  const params = new URLSearchParams(search);
  const uploadType = String(params.get("uploadType") || "ALL").toUpperCase();
  const status     = String(params.get("status")     || "ALL").toUpperCase();
  return {
    uploadType: VALID_UPLOAD_TYPES.has(uploadType) ? uploadType : "ALL",
    status:     VALID_STATUSES.has(status)         ? status     : "ALL",
  };
};

/* ── Icons ── */
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
    check:        <svg {...p}><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>,
    reject:       <svg {...p}><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>,
    filter:       <svg {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
    invoice:      <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    review:       <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    link:         <svg {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  };
  return icons[name] || <svg {...p}><circle cx="12" cy="12" r="9"/></svg>;
};

/* ── Nav items (same as dashboard) ── */
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

/* ── Shared select style ── */
const selectStyle = {
  height: 36, padding: "0 32px 0 10px", borderRadius: 8,
  border: "1px solid var(--border-light)", background: "var(--bg-3)",
  color: "var(--text-2)", fontFamily: "Outfit, sans-serif", fontSize: "0.85rem",
  cursor: "pointer", appearance: "none",
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
};

/* ── Status badge style ── */
const statusBadge = (status) => {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return { bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)",  color: "#6ee7b7" };
  if (s === "PENDING")  return { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)",  color: "#fcd34d" };
  if (s === "REJECTED") return { bg: "rgba(239,68,68,0.1)",    border: "rgba(239,68,68,0.3)",   color: "#fca5a5" };
  return                       { bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.3)", color: "#94a3b8" };
};

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
const Verifications = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialFilters = readQueryFilters(location.search);

  /* page state */
  const [proofs, setProofs]           = useState([]);
  const [reviews, setReviews]         = useState([]);
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState(initialFilters.uploadType === "REVIEW" ? "REVIEW" : "INVOICE");
  const [statusFilter, setStatusFilter]   = useState(initialFilters.status);
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");
  const [processingId, setProcessingId]   = useState(null);

  /* shell state */
  const [user, setUser]                     = useState(null);
  const [isSidebarOpen, setIsSidebarOpen]   = useState(false);
  const [approvalCounts, setApprovalCounts] = useState({});
  const activeNav = "approvals";

  const totalApprovals = useMemo(() =>
    toNum(approvalCounts?.participants) +
    toNum(approvalCounts?.product_applications) +
    toNum(approvalCounts?.purchase_proofs) +
    toNum(approvalCounts?.review_submissions),
  [approvalCounts]);

  /* load user + badge */
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

  /* load verifications */
  const load = useCallback(async () => {
    setError(""); setLoading(true);
    try {
      const proofPath = statusFilter === "PENDING"
        ? "/admin/purchase-proofs/pending"
        : statusFilter === "ALL"
          ? "/admin/purchase-proofs?limit=200"
          : `/admin/purchase-proofs?status=${statusFilter}&limit=200`;
      const reviewPath = statusFilter === "PENDING"
        ? "/admin/reviews/pending"
        : statusFilter === "ALL"
          ? "/admin/reviews?limit=200"
          : `/admin/reviews?status=${statusFilter}&limit=200`;
      const [proofRes, reviewRes] = await Promise.all([axios.get(proofPath), axios.get(reviewPath)]);
      setProofs(Array.isArray(proofRes.data?.data)  ? proofRes.data.data  : []);
      setReviews(Array.isArray(reviewRes.data?.data) ? reviewRes.data.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load verifications.");
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const next = readQueryFilters(location.search);
    setActiveTab(next.uploadType === "REVIEW" ? "REVIEW" : "INVOICE");
    setStatusFilter(next.status);
  }, [location.search]);

  useEffect(() => { setProductFilter("ALL"); }, [projectFilter]);

  const updateReviewStatus = async (id, action) => {
    if (processingId === id) return;
    setError(""); setProcessingId(id);
    try {
      await axios.patch(`/admin/reviews/${id}/${action}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} review`);
    } finally { setProcessingId(null); }
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

  /* derived */
  const rowsForFilters = useMemo(() => activeTab === "INVOICE" ? proofs : reviews, [activeTab, proofs, reviews]);

  const projectOptions = useMemo(() => {
    const map = new Map();
    for (const row of rowsForFilters) {
      const id = row.project_id;
      if (!id || map.has(id)) continue;
      map.set(id, row.project_name || row.project_title || id);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rowsForFilters]);

  const productOptions = useMemo(() => {
    const map = new Map();
    const base = rowsForFilters.filter((row) => projectFilter === "ALL" || row.project_id === projectFilter);
    for (const row of base) {
      const id = row.product_id;
      if (!id || map.has(id)) continue;
      map.set(id, row.product_name || id);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rowsForFilters, projectFilter]);

  const filteredProofs = useMemo(() =>
    proofs.filter((row) =>
      (projectFilter === "ALL" || row.project_id === projectFilter) &&
      (productFilter === "ALL" || row.product_id === productFilter)
    ), [proofs, projectFilter, productFilter]);

  const filteredReviews = useMemo(() =>
    reviews.filter((row) =>
      (projectFilter === "ALL" || row.project_id === projectFilter) &&
      (productFilter === "ALL" || row.product_id === productFilter)
    ), [reviews, projectFilter, productFilter]);

  const currentRows = activeTab === "INVOICE" ? filteredProofs : filteredReviews;
  const showActions = statusFilter === "PENDING";

  const quickStats = useMemo(() => {
    return currentRows.reduce((acc, row) => {
      acc.total += 1;
      const s = String(row?.status || "").toUpperCase();
      if (s === "PENDING")  acc.pending  += 1;
      if (s === "APPROVED") acc.approved += 1;
      if (s === "REJECTED") acc.rejected += 1;
      return acc;
    }, { total: 0, pending: 0, approved: 0, rejected: 0 });
  }, [currentRows]);

  /* ── render ── */
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

          {/* Page header */}
          <div className="sa-page-head">
            <div className="sa-page-head-left">
              <h1 className="sa-page-title">Verifi<span className="sa-highlight">cations</span></h1>
              <p className="sa-page-sub">Review and approve participant uploads</p>
            </div>
            <div className="sa-page-actions">
              <button type="button" className="sa-export-btn" onClick={() => navigate("/admin/applications")}>Back</button>
              <button type="button" className="sa-export-btn" onClick={load} disabled={loading}>
                <Icon name="refresh" size={15} /><span>Refresh</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="sa-error">
              <Icon name="alert" size={16} /> {error}
              <button type="button" onClick={() => setError("")}>✕</button>
            </div>
          )}

          {/* ── Tabs ── */}
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { key: "INVOICE", label: "Invoice Uploads", count: proofs.length,  icon: "invoice" },
              { key: "REVIEW",  label: "Review Uploads",  count: reviews.length, icon: "review"  },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  height: 40, padding: "0 18px", borderRadius: 10,
                  border: `1px solid ${activeTab === tab.key ? "rgba(99,102,241,0.45)" : "var(--border)"}`,
                  background: activeTab === tab.key ? "var(--accent-dim)" : "var(--bg-2)",
                  color: activeTab === tab.key ? "var(--accent)" : "var(--text-2)",
                  fontFamily: "Outfit, sans-serif", fontSize: "0.88rem", fontWeight: 600,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                <Icon name={tab.icon} size={16} />
                {tab.label}
                <span style={{
                  background: activeTab === tab.key ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.08)",
                  color: "inherit", fontSize: "0.72rem", fontWeight: 700,
                  padding: "1px 7px", borderRadius: 999,
                }}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* ── Stat cards ── */}
          <div className="sa-cards" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
            {[
              { label: "Total",    value: quickStats.total,    tone: "blue",  icon: "invoice"  },
              { label: "Pending",  value: quickStats.pending,  tone: "amber", icon: "alert"    },
              { label: "Approved", value: quickStats.approved, tone: "green", icon: "check"    },
              { label: "Rejected", value: quickStats.rejected, tone: "red",   icon: "reject"   },
            ].map(card => (
              <article key={card.label} className={`sa-stat-card sa-stat-card--${card.tone === "red" ? "amber" : card.tone}`}>
                <div className="sa-stat-card-top">
                  <div className={`sa-stat-icon sa-stat-icon--${card.tone === "red" ? "amber" : card.tone}`}>
                    <Icon name={card.icon} size={20} />
                  </div>
                </div>
                <p className="sa-stat-label">{card.label}</p>
                <div className="sa-stat-value">{card.value}</div>
              </article>
            ))}
          </div>

          {/* ── Filters ── */}
          <div className="sa-panel">
            <div className="sa-panel-head" style={{ marginBottom: "0.75rem" }}>
              <div><h2 className="sa-panel-title">Filters</h2></div>
              <Icon name="filter" size={16} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Status</label>
                <select style={selectStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="ALL">All</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Project</label>
                <select style={{ ...selectStyle, minWidth: 180 }} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                  <option value="ALL">All Projects</option>
                  {projectOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Product</label>
                <select style={{ ...selectStyle, minWidth: 180 }} value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
                  <option value="ALL">All Products</option>
                  {productOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Invoice Uploads Table ── */}
          {activeTab === "INVOICE" && (
            <div className="sa-panel sa-panel--table">
              <div className="sa-panel-head">
                <div>
                  <h2 className="sa-panel-title">Invoice Uploads</h2>
                  <p className="sa-panel-sub">{filteredProofs.length} records</p>
                </div>
              </div>
              <div className="sa-table-wrap">
                {loading ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 24, color: "var(--text-3)" }}>
                    <div className="sa-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />Loading invoice uploads…
                  </div>
                ) : !filteredProofs.length ? (
                  <div className="sa-empty-chart"><Icon name="invoice" size={32} /><p>No invoice uploads for selected filter.</p></div>
                ) : (
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>Project</th><th>Product</th><th>Participant</th>
                        <th>Email</th><th>Proof</th><th>Status</th><th>Uploaded</th>
                        {showActions && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProofs.map((p) => {
                        const sc = statusBadge(p.status);
                        return (
                          <tr key={p.id}>
                            <td className="sa-td-main">{p.project_name || "—"}</td>
                            <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.product_name}>{p.product_name || "—"}</td>
                            <td>{p.participant_name || "—"}</td>
                            <td className="sa-td-muted">{p.participant_email || "—"}</td>
                            <td><ProofReview proofUrl={p.file_url} /></td>
                            <td>
                              <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color }}>
                                {p.status || "—"}
                              </span>
                            </td>
                            <td className="sa-td-muted">{fmtDate(p.uploaded_at || p.created_at)}</td>
                            {showActions && (
                              <td>
                                {String(p?.status || "").toUpperCase() === "PENDING"
                                  ? <ApproveRejectionButton id={p.id} onDone={load} />
                                  : <span className="sa-td-muted">—</span>}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Review Uploads Table ── */}
          {activeTab === "REVIEW" && (
            <div className="sa-panel sa-panel--table">
              <div className="sa-panel-head">
                <div>
                  <h2 className="sa-panel-title">Review Uploads</h2>
                  <p className="sa-panel-sub">{filteredReviews.length} records</p>
                </div>
              </div>
              <div className="sa-table-wrap">
                {loading ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 24, color: "var(--text-3)" }}>
                    <div className="sa-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />Loading review uploads…
                  </div>
                ) : !filteredReviews.length ? (
                  <div className="sa-empty-chart"><Icon name="review" size={32} /><p>No review uploads for selected filter.</p></div>
                ) : (
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>Project</th><th>Product</th><th>Participant</th>
                        <th>Email</th><th>Review Link</th><th>Review Text</th>
                        <th>Status</th><th>Submitted</th>
                        {showActions && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReviews.map((review) => {
                        const sc = statusBadge(review.status);
                        return (
                          <tr key={review.id}>
                            <td className="sa-td-main">{review.project_name || "—"}</td>
                            <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={review.product_name}>{review.product_name || "—"}</td>
                            <td>{review.participant_name || "—"}</td>
                            <td className="sa-td-muted">{review.participant_email || "—"}</td>
                            <td>
                              {review.review_url ? (
                                <a href={review.review_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.78rem", fontWeight: 600, color: "var(--cyan)", textDecoration: "none" }}>
                                  <Icon name="link" size={13} />View
                                </a>
                              ) : "—"}
                            </td>
                            <td className="sa-td-muted" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={review.review_text}>{review.review_text || "—"}</td>
                            <td>
                              <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color }}>
                                {review.status || "—"}
                              </span>
                            </td>
                            <td className="sa-td-muted">{fmtDate(review.created_at)}</td>
                            {showActions && (
                              <td>
                                {String(review?.status || "").toUpperCase() === "PENDING" ? (
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                      type="button"
                                      disabled={processingId === review.id}
                                      onClick={() => updateReviewStatus(review.id, "approve")}
                                      style={{ display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 10px", borderRadius: 8, background: "var(--green-dim)", border: "1px solid rgba(16,185,129,0.35)", color: "#6ee7b7", fontFamily: "Outfit, sans-serif", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                                    >
                                      <Icon name="check" size={13} />Approve
                                    </button>
                                    <button
                                      type="button"
                                      disabled={processingId === review.id}
                                      onClick={() => updateReviewStatus(review.id, "reject")}
                                      style={{ display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 10px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontFamily: "Outfit, sans-serif", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                                    >
                                      <Icon name="reject" size={13} />Reject
                                    </button>
                                  </div>
                                ) : <span className="sa-td-muted">—</span>}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default Verifications;