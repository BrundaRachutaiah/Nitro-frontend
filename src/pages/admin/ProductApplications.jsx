import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  approveProductApplication,
  bulkDecideApplications,
  getProductApplications,
  rejectProductApplication,
} from "../../api/admin.api";
import {
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser,
} from "../../lib/auth";
import "../superAdmin/Dashboard.css";

/* Helpers */
const normalize = (v) => String(v || "").trim().toLowerCase();
const toAmount = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const fmtCurrency = (v) => inr.format(toAmount(v));
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-";
const getRequestDate = (row) => {
  const status = String(row?.status || "").toUpperCase();
  if (["APPROVED", "PURCHASED", "COMPLETED", "REJECTED"].includes(status)) {
    return row?.reviewed_at || row?.updated_at || row?.created_at || null;
  }
  return row?.updated_at || row?.created_at || null;
};
const getAutoAllocated = (row) => {
  if (row?.suggested_allocated_budget) return toAmount(row.suggested_allocated_budget);
  if (row?.requested_amount) return toAmount(row.requested_amount);
  const base = toAmount(row?.project_products?.product_value);
  const qty = Math.max(1, Number(row?.quantity || 1));
  return base * qty;
};

const Icon = ({ name, size = 18 }) => {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
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
    menu: <svg {...p}><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
    close: <svg {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>,
    refresh: <svg {...p}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
    alert: <svg {...p}><path d="m10.29 3.86-8.6 14.9A1 1 0 0 0 2.57 20h16.86a1 1 0 0 0 .88-1.24l-8.6-14.9a1 1 0 0 0-1.72 0z"/><path d="M12 9v4M12 17h.01"/></svg>,
    arrowLeft: <svg {...p}><path d="M19 12H5M12 5l-7 7 7 7"/></svg>,
    search: <svg {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>,
    filter: <svg {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
    check: <svg {...p}><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>,
    x: <svg {...p}><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>,
    link: <svg {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    package: <svg {...p}><path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>,
    prev: <svg {...p}><path d="M15 18l-6-6 6-6"/></svg>,
    next: <svg {...p}><path d="M9 18l6-6-6-6"/></svg>,
  };
  return icons[name] || <svg {...p}><circle cx="12" cy="12" r="9"/></svg>;
};

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard", path: "/dashboard" },
  { key: "participants", label: "Participants", icon: "participants", path: "/super-admin/users" },
  { key: "projects", label: "Projects", icon: "projects", path: "/projects/manage" },
  { key: "approvals", label: "Approvals", icon: "approvals", path: "/admin/applications" },
  { key: "client_budgets", label: "Client Budgets", icon: "budgets", path: "/admin/client-budgets" },
  { key: "payouts", label: "Payouts", icon: "payouts", path: "/admin/payouts" },
  { key: "payout_history", label: "Payout History", icon: "history", path: "/admin/payout-history" },
  { key: "reports", label: "Reports", icon: "reports", path: "/super-admin/reports" },
  { key: "support", label: "Support", icon: "support", path: "/super-admin/support" },
];

const StatusBadge = ({ status }) => {
  const s = String(status || "").toUpperCase();
  const map = {
    APPROVED: { cls: "sa-status-badge--published", label: "Approved" },
    PURCHASED: { cls: "sa-status-badge--published", label: "Approved" },
    COMPLETED: { cls: "sa-status-badge--published", label: "Approved" },
    PENDING: { cls: "sa-status-badge--pending", label: "Pending" },
    REJECTED: { cls: "sa-status-badge--rejected", label: "Rejected" },
  };
  const { cls, label } = map[s] || { cls: "sa-status-badge--draft", label: status || "-" };
  return <span className={`sa-status-badge sa-status-badge--sm ${cls}`}>{label}</span>;
};

const ProductApplications = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, total_pages: 1 });
  const [workingId, setWorkingId] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [confirmModal, setConfirmModal] = useState(null);
  const [selectedRows, setSelectedRows] = useState({});
  const limit = 25;

  useEffect(() => {
    const init = async () => {
      const token = getStoredToken();
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }
      try {
        const me = await verifyBackendUser(token);
        setUser(me);
      } catch {
        navigate("/login", { replace: true });
      }
    };
    init();
  }, [navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getProductApplications({ status: statusFilter, page, limit });
      const nextRows = Array.isArray(res?.data?.data) ? res.data.data : [];
      setRows(nextRows);
      setMeta(res?.data?.meta || { page: 1, limit, total: 0, total_pages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load product applications.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  useEffect(() => {
    const validIds = new Set(rows.map((r) => String(r.id)));
    setSelectedRows((prev) => {
      const next = {};
      Object.entries(prev).forEach(([id, checked]) => {
        if (checked && validIds.has(id)) next[id] = true;
      });
      return next;
    });
  }, [rows]);

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  const projectOptions = useMemo(
    () => ["ALL", ...new Set(rows.map((r) => r?.projects?.title).filter(Boolean))],
    [rows]
  );
  const productOptions = useMemo(
    () => ["ALL", ...new Set(rows.map((r) => r?.project_products?.name).filter(Boolean))],
    [rows]
  );

  const filteredRows = useMemo(() => {
    const term = normalize(search);
    return rows.filter((row) => {
      const proj = row?.projects?.title || "";
      const prod = row?.project_products?.name || "";
      const part = row?.profiles?.full_name || row?.profiles?.email || "";
      return (
        (projectFilter === "ALL" || proj === projectFilter) &&
        (productFilter === "ALL" || prod === productFilter) &&
        (!term || [proj, prod, part].some((s) => normalize(s).includes(term)))
      );
    });
  }, [rows, projectFilter, productFilter, search]);

  const participantSections = useMemo(() => {
    const map = new Map();
    const sections = [];

    for (const row of filteredRows) {
      const key = String(row?.participant_id || row?.profiles?.id || "");
      if (!map.has(key)) {
        const sec = {
          key,
          participant_id: key,
          participant_name: row?.profiles?.full_name || row?.participant_id || "-",
          participant_email: row?.profiles?.email || "",
          requested_total: 0,
          items: [],
        };
        map.set(key, sec);
        sections.push(sec);
      }
      const sec = map.get(key);
      sec.items.push(row);
      sec.requested_total += toAmount(row?.requested_amount);
    }

    return sections;
  }, [filteredRows]);

  const toggleRow = (row, checked) => {
    const isPending = String(row?.status || "").toUpperCase() === "PENDING";
    if (!isPending) return;
    setSelectedRows((prev) => ({ ...prev, [row.id]: checked }));
  };

  const getSectionSelectedPendingIds = (section) => section.items
    .filter((row) => String(row?.status || "").toUpperCase() === "PENDING" && !!selectedRows[row.id])
    .map((row) => row.id);

  const onApprove = async (row, budgetOverride) => {
    const budget = toAmount(budgetOverride ?? getAutoAllocated(row));
    setWorkingId(`approve-${row.id}`);
    setError("");
    try {
      await approveProductApplication(row.id, { allocated_budget: budget });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to approve.");
    } finally {
      setWorkingId("");
      setConfirmModal(null);
    }
  };

  const onReject = async (id) => {
    setWorkingId(`reject-${id}`);
    setError("");
    try {
      await rejectProductApplication(id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to reject.");
    } finally {
      setWorkingId("");
      setConfirmModal(null);
    }
  };

  const onBulkAction = async (section, action) => {
    const ids = getSectionSelectedPendingIds(section);
    if (!ids.length) return;

    setWorkingId(`bulk-${action}-${section.key}`);
    setError("");
    try {
      const payload = ids.map((applicationId) => ({ applicationId, action }));
      const res = await bulkDecideApplications(payload);
      const failures = res?.data?.data?.failures || [];
      const participantErrors = res?.data?.data?.participant_errors || [];
      if (failures.length || participantErrors.length) {
        const parts = [];
        if (failures.length) parts.push(`${failures.length} row(s) failed`);
        if (participantErrors.length) parts.push(`${participantErrors.length} participant summary error(s)`);
        setError(`Bulk ${action.toLowerCase()} completed with issues: ${parts.join(", ")}.`);
      }
      setSelectedRows((prev) => {
        const next = { ...prev };
        ids.forEach((id) => { delete next[id]; });
        return next;
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || `Unable to ${action.toLowerCase()} selected rows.`);
    } finally {
      setWorkingId("");
    }
  };

  return (
    <div className="sa-dashboard">
      {confirmModal && (
        <div className="su-modal-overlay">
          <div className="su-modal">
            <div className="su-modal-icon"><Icon name="alert" size={22} /></div>
            <h3 className="su-modal-title">Confirm {confirmModal.action === "approve" ? "Approval" : "Rejection"}</h3>
            <div className="su-modal-body">
              {confirmModal.action === "approve" ? (
                <>
                  <div style={{ marginBottom: 10 }}>
                    Approve <strong>{confirmModal.name}</strong>'s application for <strong>{confirmModal.product}</strong>?
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="sa-td-muted">Allocated budget (₹)</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={toAmount(confirmModal.budget)}
                        onChange={(e) => setConfirmModal((prev) => prev ? ({ ...prev, budget: toAmount(e.target.value) }) : prev)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(255,255,255,0.04)",
                          color: "white",
                        }}
                      />
                    </label>

                    <div className="sa-td-muted" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span>Project budget: <strong style={{ color: "var(--green)" }}>{fmtCurrency(confirmModal.row?.project_budget)}</strong></span>
                      <span>Remaining: <strong style={{ color: "var(--green)" }}>{fmtCurrency(confirmModal.row?.project_remaining_budget)}</strong></span>
                      <span>
  Requested: <strong>{fmtCurrency(confirmModal.row?.requested_amount)}</strong>
  {(confirmModal.row?.quantity > 1) && (
    <span style={{ fontSize: '12px', color: '#9aa3b2', marginLeft: '6px' }}>
      ({confirmModal.row?.quantity} units × {fmtCurrency((confirmModal.row?.requested_amount || 0) / (confirmModal.row?.quantity || 1))})
    </span>
  )}
</span>
                    </div>

                    {toAmount(confirmModal.budget) > toAmount(confirmModal.row?.project_remaining_budget) && (
                      <div className="sa-td-muted" style={{ color: "#ffb020" }}>
                        Allocated budget exceeds remaining project budget.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>Reject <strong>{confirmModal.name}</strong>'s application for <strong>{confirmModal.product}</strong>?</>
              )}
            </div>
            <div className="su-modal-actions">
              <button type="button" className="su-action-btn su-action-btn--ghost" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button
                type="button"
                className={`su-action-btn ${confirmModal.action === "approve" ? "su-action-btn--approve" : "su-action-btn--reject"}`}
                disabled={
                  !!workingId
                  || (confirmModal.action === "approve" && (
                    toAmount(confirmModal.budget) <= 0
                    || toAmount(confirmModal.budget) > toAmount(confirmModal.row?.project_remaining_budget)
                  ))
                }
                onClick={() => (confirmModal.action === "approve" ? onApprove(confirmModal.row, confirmModal.budget) : onReject(confirmModal.id))}
              >
                {workingId ? "Working..." : confirmModal.action === "approve" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="sa-topbar">
        <button type="button" className="sa-menu-btn" onClick={() => setIsSidebarOpen((v) => !v)}>
          <Icon name={isSidebarOpen ? "close" : "menu"} size={20} />
        </button>
        <div className="sa-brand"><span className="sa-brand-n">N</span>ITRO</div>
        <div className="sa-search-wrap">
          <span className="sa-search-icon"><Icon name="search" size={16} /></span>
          <input
            type="text"
            className="sa-search"
            placeholder="Search participant, brand, product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`sa-nav-item ${item.key === "approvals" ? "sa-nav-item--active" : ""}`}
                onClick={() => { setIsSidebarOpen(false); navigate(item.path); }}
              >
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
                <span>Product Applications</span>
              </div>
              <h1 className="sa-page-title">Product <span className="sa-highlight">Applications</span></h1>
              <p className="sa-page-sub">Approve or reject participant applications across all brands</p>
            </div>
            <div className="sa-page-actions">
              <button type="button" className="sa-export-btn" onClick={() => navigate("/admin/applications")}>
                <Icon name="arrowLeft" size={16} /><span>Back</span>
              </button>
              <button type="button" className="sa-export-btn" onClick={load} disabled={loading}>
                <Icon name="refresh" size={16} /><span>{loading ? "Loading..." : "Refresh"}</span>
              </button>
            </div>
          </div>

          {error && <div className="sa-error"><Icon name="alert" size={16} /> {error}<button type="button" onClick={() => setError("")}>x</button></div>}

          <div className="sa-panel">
            <div className="sa-panel-head" style={{ marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-3)" }}>
                <Icon name="filter" size={15} />
                <h2 className="sa-panel-title" style={{ margin: 0, fontSize: "0.9rem" }}>Filters</h2>
              </div>
            </div>
            <div className="pj-filter-bar">
              <div className="pj-filter-left" style={{ flexWrap: "wrap" }}>
                <select className="pj-select" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                  {projectOptions.map((p) => <option key={p} value={p}>{p === "ALL" ? "All Brands" : p}</option>)}
                </select>
                <select className="pj-select" value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
                  {productOptions.map((p) => <option key={p} value={p}>{p === "ALL" ? "All Products" : p}</option>)}
                </select>
                <select className="pj-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="ALL">All Statuses</option>
                </select>
              </div>
              <span className="su-result-count">{filteredRows.length} result{filteredRows.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {loading ? (
            <div className="sa-panel pd-loading"><div className="sa-spinner" /><p>Loading product applications...</p></div>
          ) : participantSections.length === 0 ? (
            <div className="sa-panel pd-loading">
              <Icon name="package" size={32} />
              <p>No product applications for selected status.</p>
            </div>
          ) : (
            participantSections.map((section) => {
              const selectedPendingIds = getSectionSelectedPendingIds(section);
              const bulkBusyApprove = workingId === `bulk-APPROVE-${section.key}`;
              const bulkBusyReject = workingId === `bulk-REJECT-${section.key}`;

              return (
                <div key={section.key} className="sa-panel sa-panel--table">
                  <div className="sa-panel-head app-section-head">
                    <div>
                      <h2 className="sa-panel-title">{section.participant_name}</h2>
                      <p className="sa-panel-sub">{section.participant_email || "-"} - {section.items.length} request{section.items.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className="su-result-count">Selected: {selectedPendingIds.length}</span>
                      <button
                        type="button"
                        className="su-action-btn su-action-btn--approve"
                        disabled={!!workingId || selectedPendingIds.length === 0}
                        onClick={() => onBulkAction(section, "APPROVE")}
                      >
                        <Icon name="check" size={13} /> {bulkBusyApprove ? "Working..." : "Approve Selected"}
                      </button>
                      <button
                        type="button"
                        className="su-action-btn su-action-btn--reject"
                        disabled={!!workingId || selectedPendingIds.length === 0}
                        onClick={() => onBulkAction(section, "REJECT")}
                      >
                        <Icon name="x" size={13} /> {bulkBusyReject ? "Working..." : "Reject Selected"}
                      </button>
                    </div>
                  </div>

                  <div className="sa-table-wrap" style={{ marginTop: 0 }}>
                    <table className="sa-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}></th>
                          <th>Product</th>
                          <th>Product URL</th>
                          <th>Requested</th>
                          <th>Auto-Allocated</th>
                          <th>Remaining Budget</th>
                          <th>Date</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.items.map((row) => {
                          const budget = getAutoAllocated(row);
                          const isPending = String(row?.status || "").toUpperCase() === "PENDING";
                          const remainingBudget = toAmount(row?.project_remaining_budget);
                          const canApprove = row?.can_approve !== false && budget > 0;
                          const brand = row?.projects?.title || row?.project_title || "-";
                          return (
                            <tr key={row.id} className="sa-table-row--clickable">
                              <td>
                                <input
                                  type="checkbox"
                                  checked={!!selectedRows[row.id]}
                                  disabled={!isPending || (!!workingId && workingId !== `approve-${row.id}` && workingId !== `reject-${row.id}`)}
                                  onChange={(e) => toggleRow(row, e.target.checked)}
                                  aria-label={`Select ${row?.project_products?.name || "product"}`}
                                />
                              </td>
                              <td className="sa-td-main">
                                {row?.project_products?.name || row?.product_id || "-"}
                                <div className="sa-td-muted" style={{ fontSize: "0.75rem" }}>{brand}</div>
                              </td>
                              <td>
                                {row?.project_products?.product_url
                                  ? <a href={row.project_products.product_url} target="_blank" rel="noreferrer" className="pd-ext-link"><Icon name="link" size={12} /> Open</a>
                                  : <span className="sa-td-muted">-</span>}
                              </td>
                              <td className="sa-td-bold">
  {fmtCurrency(row?.requested_amount)}
  {(row?.quantity > 1) && (
    <div style={{ fontSize: '11px', color: '#9aa3b2', fontWeight: 400, marginTop: '2px' }}>
      {row?.quantity} × {fmtCurrency((row?.requested_amount || 0) / (row?.quantity || 1))}
    </div>
  )}
</td>
                              <td><span className="sa-td-bold" style={{ color: "var(--green)" }}>{fmtCurrency(budget)}</span></td>
                              <td className="sa-td-muted">{fmtCurrency(remainingBudget)}</td>
                              <td className="sa-td-muted">{fmtDate(getRequestDate(row))}</td>
                              <td>
                                {isPending ? (
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                      type="button"
                                      className="su-action-btn su-action-btn--approve"
                                      disabled={(!!workingId && workingId !== `approve-${row.id}`) || !canApprove}
                                      onClick={() => setConfirmModal({ action: "approve", id: row.id, row, name: section.participant_name || "participant", product: row?.project_products?.name, budget })}
                                    >
                                      <Icon name="check" size={13} /> Approve
                                    </button>
                                    <button
                                      type="button"
                                      className="su-action-btn su-action-btn--reject"
                                      disabled={!!workingId && workingId !== `reject-${row.id}`}
                                      onClick={() => setConfirmModal({ action: "reject", id: row.id, name: section.participant_name || "participant", product: row?.project_products?.name })}
                                    >
                                      <Icon name="x" size={13} /> Reject
                                    </button>
                                  </div>
                                ) : <StatusBadge status={row?.status} />}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}

          {Number(meta.total_pages || 1) > 1 && (
            <div className="app-pagination">
              <span className="su-result-count">Page {meta.page || page} of {meta.total_pages || 1} ({meta.total || 0} total)</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="su-action-btn su-action-btn--ghost" disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <Icon name="prev" size={14} /> Previous
                </button>
                <button type="button" className="su-action-btn su-action-btn--ghost" disabled={loading || page >= Number(meta.total_pages || 1)} onClick={() => setPage((p) => p + 1)}>
                  Next <Icon name="next" size={14} />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ProductApplications;