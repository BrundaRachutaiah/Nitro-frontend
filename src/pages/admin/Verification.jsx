import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProofReview from "../../components/verification/ProofPreview";
import axios from "../../api/axiosInstance";
import {
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser,
  API_BASE_URL,
} from "../../lib/auth";
import "../superAdmin/Dashboard.css";

const VALID_STATUSES = new Set(["ALL", "PENDING", "APPROVED", "REJECTED"]);
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";

const readQueryFilters = (search) => {
  const params = new URLSearchParams(search);
  const status = String(params.get("status") || "ALL").toUpperCase();
  return {
    status: VALID_STATUSES.has(status) ? status : "ALL",
  };
};

const ScreenshotCell = ({ urls = [] }) => {
  if (!Array.isArray(urls) || urls.length === 0) {
    return <span className="sa-td-muted">-</span>;
  }

  const visible = urls.slice(0, 3);
  const remaining = urls.length - visible.length;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {visible.map((url, index) => (
        <a
          key={`${url}-${index}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          title={`Open screenshot ${index + 1}`}
          style={{ display: "inline-block" }}
        >
          <img
            src={url}
            alt={`Review screenshot ${index + 1}`}
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              objectFit: "cover",
              border: "1px solid rgba(148,163,184,0.28)",
              background: "rgba(15,23,42,0.5)",
              display: "block",
            }}
          />
        </a>
      ))}
      {remaining > 0 ? (
        <span style={{ fontSize: "0.76rem", color: "var(--text-3)", fontWeight: 600 }}>
          +{remaining} more
        </span>
      ) : null}
    </div>
  );
};

const statusBadge = (status) => {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") {
    return { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", color: "#6ee7b7", label: "Approved" };
  }
  if (s === "PENDING") {
    return { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", color: "#fcd34d", label: "Pending" };
  }
  if (s === "REJECTED") {
    return { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", color: "#fca5a5", label: "Rejected" };
  }
  return { bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.3)", color: "#94a3b8", label: "Not Submitted" };
};

const StatusPill = ({ status }) => {
  const sc = statusBadge(status);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: "0.7rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        background: sc.bg,
        border: `1px solid ${sc.border}`,
        color: sc.color,
      }}
    >
      {sc.label}
    </span>
  );
};

const ActionButtons = ({ disabled, onApprove, onReject }) => (
  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
    <button
      type="button"
      disabled={disabled}
      onClick={onApprove}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 32,
        padding: "0 12px",
        borderRadius: 9,
        background: "var(--green-dim)",
        border: "1px solid rgba(16,185,129,0.35)",
        color: "#6ee7b7",
        fontFamily: "Outfit, sans-serif",
        fontSize: "0.78rem",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      Approve
    </button>
    <button
      type="button"
      disabled={disabled}
      onClick={onReject}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 32,
        padding: "0 12px",
        borderRadius: 9,
        background: "rgba(239,68,68,0.1)",
        border: "1px solid rgba(239,68,68,0.3)",
        color: "#fca5a5",
        fontFamily: "Outfit, sans-serif",
        fontSize: "0.78rem",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      Reject
    </button>
  </div>
);

const selectStyle = {
  height: 36,
  padding: "0 32px 0 10px",
  borderRadius: 8,
  border: "1px solid var(--border-light)",
  background: "var(--bg-3)",
  color: "var(--text-2)",
  fontFamily: "Outfit, sans-serif",
  fontSize: "0.85rem",
  cursor: "pointer",
  appearance: "none",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
};

const cardStyle = {
  border: "1px solid rgba(148,163,184,0.14)",
  background: "rgba(15,23,42,0.38)",
  borderRadius: 14,
  padding: 14,
  minWidth: 240,
};

const buildRowKey = (row) =>
  [
    row.participant_id || "na",
    row.project_id || "na",
    row.product_id || "na",
    row.allocation_id || "na",
  ].join("::");

const mergeRows = (proofs, reviews) => {
  const map = new Map();

  for (const proof of proofs) {
    const key = buildRowKey(proof);
    map.set(key, {
      key,
      project_id: proof.project_id || null,
      project_name: proof.project_name || null,
      product_id: proof.product_id || null,
      product_name: proof.product_name || null,
      participant_id: proof.participant_id || null,
      participant_name: proof.participant_name || null,
      participant_email: proof.participant_email || null,
      allocation_id: proof.allocation_id || null,
      invoice: proof,
      review: null,
    });
  }

  for (const review of reviews) {
    const key = buildRowKey(review);
    const existing = map.get(key);
    if (existing) {
      existing.review = review;
      existing.project_name = existing.project_name || review.project_name || null;
      existing.product_name = existing.product_name || review.product_name || null;
      existing.participant_name = existing.participant_name || review.participant_name || null;
      existing.participant_email = existing.participant_email || review.participant_email || null;
      continue;
    }

    map.set(key, {
      key,
      project_id: review.project_id || null,
      project_name: review.project_name || null,
      product_id: review.product_id || null,
      product_name: review.product_name || null,
      participant_id: review.participant_id || null,
      participant_name: review.participant_name || null,
      participant_email: review.participant_email || null,
      allocation_id: review.allocation_id || null,
      invoice: null,
      review,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const aDate = new Date(a.review?.created_at || a.invoice?.uploaded_at || a.invoice?.created_at || 0).getTime();
    const bDate = new Date(b.review?.created_at || b.invoice?.uploaded_at || b.invoice?.created_at || 0).getTime();
    return bDate - aDate;
  });
};

const getOverallState = (row) => {
  const invoiceStatus = String(row.invoice?.status || "").toUpperCase();
  const reviewStatus = String(row.review?.status || "").toUpperCase();

  if (invoiceStatus === "REJECTED" || reviewStatus === "REJECTED") return "Needs attention";
  if (invoiceStatus === "PENDING" || reviewStatus === "PENDING") return "Pending review";
  if (invoiceStatus === "APPROVED" && reviewStatus === "APPROVED") return "Completed";
  if (invoiceStatus === "APPROVED" && !reviewStatus) return "Waiting for review upload";
  if (!invoiceStatus && reviewStatus === "PENDING") return "Review pending";
  if (!invoiceStatus && !reviewStatus) return "No uploads";
  return "In progress";
};

const rowMatchesStatus = (row, status) => {
  if (status === "ALL") return true;
  const invoiceStatus = String(row.invoice?.status || "").toUpperCase();
  const reviewStatus = String(row.review?.status || "").toUpperCase();
  return invoiceStatus === status || reviewStatus === status;
};

const invoiceActionState = (row) => {
  const status = String(row.invoice?.status || "").toUpperCase();
  if (status === "PENDING") return "pending";
  if (status === "APPROVED") return "done";
  if (status === "REJECTED") return "rejected";
  return "empty";
};

const reviewActionState = (row) => {
  const status = String(row.review?.status || "").toUpperCase();
  if (status === "PENDING") return "pending";
  if (status === "APPROVED") return "done";
  if (status === "REJECTED") return "rejected";
  return "empty";
};

const renderActionState = (state, buttons) => {
  if (state === "pending") return buttons;
  if (state === "done") return <span className="sa-td-muted">Approved</span>;
  if (state === "rejected") return <span className="sa-td-muted">Rejected</span>;
  return <span className="sa-td-muted">Not uploaded</span>;
};

const Icon = ({ name, size = 18 }) => {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const icons = {
    dashboard: <svg {...p}><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></svg>,
    participants: <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    projects: <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></svg>,
    approvals: <svg {...p}><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>,
    budgets: <svg {...p}><path d="M3 7h18v10H3z"/><path d="M3 10h18M8 14h2"/></svg>,
    payouts: <svg {...p}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    history: <svg {...p}><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>,
    reports: <svg {...p}><path d="M4 19h16M7 16V8M12 16V5M17 16v-3"/></svg>,
    support: <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.3 1.7c-.7.7-1.3 1.1-1.3 2.3M12 17h.01"/></svg>,
    alert: <svg {...p}><path d="m10.29 3.86-8.6 14.9A1 1 0 0 0 2.57 20h16.86a1 1 0 0 0 .88-1.24l-8.6-14.9a1 1 0 0 0-1.72 0z"/><path d="M12 9v4M12 17h.01"/></svg>,
    menu: <svg {...p}><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
    close: <svg {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>,
    refresh: <svg {...p}><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
    filter: <svg {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
    invoice: <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    review: <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  };
  return icons[name] || <svg {...p}><circle cx="12" cy="12" r="9"/></svg>;
};

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard", path: "/dashboard" },
  { key: "participants", label: "Participants", icon: "participants", path: "/super-admin/users" },
  { key: "projects", label: "Projects", icon: "projects", path: "/projects/manage" },
  { key: "approvals", label: "Approvals", icon: "approvals", path: "/admin/applications", badge: true },
  { key: "client_budgets", label: "Client Budgets", icon: "budgets", path: "/admin/client-budgets" },
  { key: "payouts", label: "Payouts", icon: "payouts", path: "/admin/payouts" },
  { key: "payout_history", label: "Payout History", icon: "history", path: "/admin/payout-history" },
  { key: "reports", label: "Reports", icon: "reports", path: "/super-admin/reports" },
  { key: "support", label: "Support", icon: "support", path: "/super-admin/support" },
];

const Verifications = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialFilters = readQueryFilters(location.search);

  const [proofs, setProofs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(initialFilters.status);
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");
  const [processingKey, setProcessingKey] = useState(null);
  const [user, setUser] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [approvalCounts, setApprovalCounts] = useState({});
  const activeNav = "approvals";

  const totalApprovals = useMemo(
    () =>
      toNum(approvalCounts?.participants) +
      toNum(approvalCounts?.product_applications) +
      toNum(approvalCounts?.purchase_proofs) +
      toNum(approvalCounts?.review_submissions),
    [approvalCounts]
  );

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const me = await verifyBackendUser(token);
        if (mounted) setUser(me);
        const res = await fetch(`${API_BASE_URL}/admin/approvals/count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (mounted) setApprovalCounts(data?.data || {});
      } catch {
        clearStoredTokens();
        navigate("/login", { replace: true });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [proofRes, reviewRes] = await Promise.all([
        axios.get("/admin/purchase-proofs?limit=200"),
        axios.get("/admin/reviews?limit=200"),
      ]);
      setProofs(Array.isArray(proofRes.data?.data) ? proofRes.data.data : []);
      setReviews(Array.isArray(reviewRes.data?.data) ? reviewRes.data.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load verifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const next = readQueryFilters(location.search);
    setStatusFilter(next.status);
  }, [location.search]);

  useEffect(() => {
    setProductFilter("ALL");
  }, [projectFilter]);

  const handleProofStatus = async (id, action) => {
    const currentKey = `invoice:${id}:${action}`;
    if (processingKey === currentKey) return;
    setError("");
    setProcessingKey(currentKey);
    try {
      await axios.patch(`/admin/purchase-proofs/${id}/${action}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} invoice`);
    } finally {
      setProcessingKey(null);
    }
  };

  const handleReviewStatus = async (id, action) => {
    const currentKey = `review:${id}:${action}`;
    if (processingKey === currentKey) return;
    setError("");
    setProcessingKey(currentKey);
    try {
      await axios.patch(`/admin/reviews/${id}/${action}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} review`);
    } finally {
      setProcessingKey(null);
    }
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

  const combinedRows = useMemo(() => mergeRows(proofs, reviews), [proofs, reviews]);

  const projectOptions = useMemo(() => {
    const map = new Map();
    for (const row of combinedRows) {
      const id = row.project_id;
      if (!id || map.has(id)) continue;
      map.set(id, row.project_name || id);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [combinedRows]);

  const productOptions = useMemo(() => {
    const map = new Map();
    const base = combinedRows.filter((row) => projectFilter === "ALL" || row.project_id === projectFilter);
    for (const row of base) {
      const id = row.product_id;
      if (!id || map.has(id)) continue;
      map.set(id, row.product_name || id);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [combinedRows, projectFilter]);

  const filteredRows = useMemo(
    () =>
      combinedRows.filter(
        (row) =>
          (projectFilter === "ALL" || row.project_id === projectFilter) &&
          (productFilter === "ALL" || row.product_id === productFilter) &&
          rowMatchesStatus(row, statusFilter)
      ),
    [combinedRows, productFilter, projectFilter, statusFilter]
  );

  const quickStats = useMemo(
    () =>
      filteredRows.reduce(
        (acc, row) => {
          acc.total += 1;
          if (String(row.invoice?.status || "").toUpperCase() === "PENDING") acc.pendingInvoice += 1;
          if (String(row.review?.status || "").toUpperCase() === "PENDING") acc.pendingReview += 1;
          if (
            String(row.invoice?.status || "").toUpperCase() === "APPROVED" &&
            String(row.review?.status || "").toUpperCase() === "APPROVED"
          ) {
            acc.completed += 1;
          }
          return acc;
        },
        { total: 0, pendingInvoice: 0, pendingReview: 0, completed: 0 }
      ),
    [filteredRows]
  );

  return (
    <div className="sa-dashboard">
      <header className="sa-topbar">
        <button
          type="button"
          className="sa-menu-btn"
          onClick={() => setIsSidebarOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <Icon name={isSidebarOpen ? "close" : "menu"} size={20} />
        </button>
        <div className="sa-brand"><span className="sa-brand-n">N</span>ITRO</div>
        <div style={{ flex: 1 }} />
        <div className="sa-topbar-right">
          {totalApprovals > 0 && (
            <button type="button" className="sa-alert-btn" onClick={() => navigate("/admin/applications")}>
              <Icon name="alert" size={16} />
              <span>{totalApprovals} pending</span>
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
        {isSidebarOpen && (
          <button
            type="button"
            className="sa-backdrop"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close menu"
          />
        )}

        <aside className={`sa-sidebar ${isSidebarOpen ? "sa-sidebar--open" : ""}`}>
          <nav className="sa-nav">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`sa-nav-item ${activeNav === item.key ? "sa-nav-item--active" : ""}`}
                onClick={() => handleNavClick(item)}
              >
                <span className="sa-nav-icon"><Icon name={item.icon} size={18} /></span>
                <span className="sa-nav-label">{item.label}</span>
                {item.badge && totalApprovals > 0 && <span className="sa-nav-badge">{totalApprovals}</span>}
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
              <h1 className="sa-page-title">Verifi<span className="sa-highlight">cations</span></h1>
              <p className="sa-page-sub">Review invoice and review submissions together in one row</p>
            </div>
            <div className="sa-page-actions">
              <button type="button" className="sa-export-btn" onClick={() => navigate("/admin/applications")}>Back</button>
              <button type="button" className="sa-export-btn" onClick={load} disabled={loading}>
                <Icon name="refresh" size={15} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="sa-error">
              <Icon name="alert" size={16} /> {error}
              <button type="button" onClick={() => setError("")}>x</button>
            </div>
          )}

          <div className="sa-cards" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
            {[
              { label: "Rows", value: quickStats.total, tone: "blue", icon: "approvals" },
              { label: "Pending Invoice", value: quickStats.pendingInvoice, tone: "amber", icon: "invoice" },
              { label: "Pending Review", value: quickStats.pendingReview, tone: "amber", icon: "review" },
              { label: "Completed Both", value: quickStats.completed, tone: "green", icon: "approvals" },
            ].map((card) => (
              <article key={card.label} className={`sa-stat-card sa-stat-card--${card.tone}`}>
                <div className="sa-stat-card-top">
                  <div className={`sa-stat-icon sa-stat-icon--${card.tone}`}>
                    <Icon name={card.icon} size={20} />
                  </div>
                </div>
                <p className="sa-stat-label">{card.label}</p>
                <div className="sa-stat-value">{card.value}</div>
              </article>
            ))}
          </div>

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
                  {projectOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Product</label>
                <select style={{ ...selectStyle, minWidth: 180 }} value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
                  <option value="ALL">All Products</option>
                  {productOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="sa-panel sa-panel--table">
            <div className="sa-panel-head">
              <div>
                <h2 className="sa-panel-title">Combined Verification Queue</h2>
                <p className="sa-panel-sub">{filteredRows.length} rows</p>
              </div>
            </div>
            <div className="sa-table-wrap">
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 24, color: "var(--text-3)" }}>
                  <div className="sa-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                  Loading verifications...
                </div>
              ) : !filteredRows.length ? (
                <div className="sa-empty-chart">
                  <Icon name="approvals" size={32} />
                  <p>No verification rows for the selected filters.</p>
                </div>
              ) : (
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Product</th>
                      <th>Participant</th>
                      <th>Invoice Verification</th>
                      <th>Review Verification</th>
                      <th>Overall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const invoiceState = invoiceActionState(row);
                      const reviewState = reviewActionState(row);
                      return (
                        <tr key={row.key}>
                          <td className="sa-td-main">{row.project_name || "-"}</td>
                          <td style={{ minWidth: 180 }}>
                            <div style={{ fontWeight: 600, color: "var(--text-1)" }}>{row.product_name || "-"}</div>
                          </td>
                          <td style={{ minWidth: 190 }}>
                            <div style={{ fontWeight: 600, color: "var(--text-1)" }}>{row.participant_name || "-"}</div>
                            <div className="sa-td-muted" style={{ marginTop: 4 }}>{row.participant_email || "-"}</div>
                          </td>
                          <td style={{ minWidth: 290 }}>
                            <div style={cardStyle}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
                                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                  Invoice Proof
                                </span>
                                <StatusPill status={row.invoice?.status} />
                              </div>
                              <div style={{ marginBottom: 12 }}>
                                {row.invoice?.file_url ? <ProofReview proofUrl={row.invoice.file_url} /> : <span className="sa-td-muted">Not uploaded</span>}
                              </div>
                              <div className="sa-td-muted" style={{ marginBottom: 12 }}>
                                Uploaded: {fmtDate(row.invoice?.uploaded_at || row.invoice?.created_at)}
                              </div>
                              {renderActionState(
                                invoiceState,
                                <ActionButtons
                                  disabled={processingKey?.startsWith("invoice:")}
                                  onApprove={() => handleProofStatus(row.invoice.id, "approve")}
                                  onReject={() => handleProofStatus(row.invoice.id, "reject")}
                                />
                              )}
                            </div>
                          </td>
                          <td style={{ minWidth: 320 }}>
                            <div style={cardStyle}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
                                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                  Review Screenshot
                                </span>
                                <StatusPill status={row.review?.status} />
                              </div>
                              <div style={{ marginBottom: 12 }}>
                                <ScreenshotCell urls={row.review?.review_screenshots || (row.review?.review_url ? [row.review.review_url] : [])} />
                              </div>
                              <div
                                className="sa-td-muted"
                                style={{
                                  marginBottom: 12,
                                  lineHeight: 1.5,
                                  display: "-webkit-box",
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                                title={row.review?.review_text_display || row.review?.review_text || ""}
                              >
                                {row.review?.review_text_display || row.review?.review_text || "No review text"}
                              </div>
                              <div className="sa-td-muted" style={{ marginBottom: 12 }}>
                                Submitted: {fmtDate(row.review?.created_at)}
                              </div>
                              {renderActionState(
                                reviewState,
                                <ActionButtons
                                  disabled={processingKey?.startsWith("review:")}
                                  onApprove={() => handleReviewStatus(row.review.id, "approve")}
                                  onReject={() => handleReviewStatus(row.review.id, "reject")}
                                />
                              )}
                            </div>
                          </td>
                          <td style={{ minWidth: 180 }}>
                            <div style={{ fontWeight: 700, color: "var(--text-1)", marginBottom: 10 }}>
                              {getOverallState(row)}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <div className="sa-td-muted">Invoice: {statusBadge(row.invoice?.status).label}</div>
                              <div className="sa-td-muted">Review: {statusBadge(row.review?.status).label}</div>
                            </div>
                          </td>
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

export default Verifications;
