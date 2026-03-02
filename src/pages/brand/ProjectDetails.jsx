import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBrandProjects, updateProject, updateProjectStatus } from "../../api/brand.api";
import {
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser,
} from "../../lib/auth";
import "../superAdmin/Dashboard.css";

/* ─── Formatters ── */
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const fmtCurrency = (v) => inr.format(Number(v || 0));
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const blankProduct = { name: "", product_url: "", price: "" };

/* ─── Icons ── */
const Icon = ({ name, size = 18 }) => {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
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
    edit:         <svg {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>,
    check:        <svg {...p}><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>,
    archive:      <svg {...p}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
    link:         <svg {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    plus:         <svg {...p}><path d="M12 5v14M5 12h14"/></svg>,
    trash:        <svg {...p}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    package:      <svg {...p}><path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>,
    calendar:     <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>,
    tag:          <svg {...p}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    arrowLeft:    <svg {...p}><path d="M19 12H5M12 5l-7 7 7 7"/></svg>,
    arrow:        <svg {...p}><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
    globe:        <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    info:         <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 12v4"/></svg>,
    save:         <svg {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
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

const STATUS_META = {
  PUBLISHED: { cls: "sa-status-badge--published", label: "Published" },
  DRAFT:     { cls: "sa-status-badge--draft",     label: "Draft" },
  ARCHIVED:  { cls: "sa-status-badge--pending",   label: "Archived" },
};

/* ─── Styled input ── */
const FormInput = ({ label, ...props }) => (
  <div className="pjd-field">
    {label && <label className="pjd-label">{label}</label>}
    <input className="pjd-input" {...props} />
  </div>
);

const FormTextarea = ({ label, ...props }) => (
  <div className="pjd-field">
    {label && <label className="pjd-label">{label}</label>}
    <textarea className="pjd-textarea" {...props} />
  </div>
);

const FormSelect = ({ label, children, ...props }) => (
  <div className="pjd-field">
    {label && <label className="pjd-label">{label}</label>}
    <select className="pjd-select" {...props}>{children}</select>
  </div>
);

/* ════════════════════════════════════════════
   MAIN — Project Details
════════════════════════════════════════════ */
const ProjectDetails = () => {
  const navigate    = useNavigate();
  const { projectId } = useParams();

  const [user, setUser]         = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [role, setRole]         = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [isEditing, setIsEditing]   = useState(false);
  const [saveBusy, setSaveBusy]     = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "", description: "", category: "", reward: "",
    mode: "MARKETPLACE", total_units: "",
    start_date: "", end_date: "", product_url: "",
    products: [{ ...blankProduct }],
  });

  /* ── Load ── */
  useEffect(() => {
    const load = async () => {
      setLoading(true); setError("");
      try {
        const token = getStoredToken();
        if (!token) { navigate("/login", { replace: true }); return; }
        const me = await verifyBackendUser(token);
        setUser(me);
        setRole(String(me?.role || "").toUpperCase());
        const res = await getBrandProjects();
        setProjects(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load project details.");
      } finally { setLoading(false); }
    };
    load();
  }, [projectId, navigate]);

  const project = useMemo(
    () => projects.find((p) => String(p.id) === String(projectId)) || null,
    [projects, projectId]
  );

  useEffect(() => {
    if (!project) return;
    setEditForm({
      title:       project.title || project.name || "",
      description: project.description || "",
      category:    project.category || "",
      reward:      project.reward ?? "",
      mode:        project.mode || "MARKETPLACE",
      total_units: project.total_units ?? "",
      start_date:  project.start_date ? String(project.start_date).slice(0, 10) : "",
      end_date:    project.end_date   ? String(project.end_date).slice(0, 10)   : "",
      product_url: project.product_url || "",
      products: Array.isArray(project.project_products) && project.project_products.length
        ? project.project_products.map((p) => ({ name: p?.name || "", product_url: p?.product_url || "", price: p?.product_value ?? "" }))
        : [{ ...blankProduct }],
    });
  }, [project]);

  const refreshProject = async () => {
    const res = await getBrandProjects();
    setProjects(Array.isArray(res.data?.data) ? res.data.data : []);
  };

  const onStatusChange = async (newStatus) => {
    if (!project?.id) return;
    setStatusBusy(true); setError("");
    try { await updateProjectStatus(project.id, newStatus); await refreshProject(); }
    catch (err) { setError(err.response?.data?.message || "Failed to update status."); }
    finally { setStatusBusy(false); }
  };

  const onSaveDraft = async () => {
    if (!project?.id) return;
    setSaveBusy(true); setError("");
    try {
      await updateProject(project.id, {
        name: editForm.title, title: editForm.title,
        description: editForm.description, category: editForm.category,
        reward: Number(editForm.reward || 0), mode: editForm.mode,
        total_units: Number(editForm.total_units || 0),
        start_date: editForm.start_date, end_date: editForm.end_date,
        product_url: editForm.product_url,
        products: editForm.products
          .map((p) => ({ name: String(p?.name || "").trim(), product_url: String(p?.product_url || "").trim(), price: Number(p?.price || 0), product_value: Number(p?.price || 0) }))
          .filter((p) => p.name && p.product_url),
      });
      await refreshProject();
      setIsEditing(false);
    } catch (err) { setError(err.response?.data?.message || "Failed to save draft."); }
    finally { setSaveBusy(false); }
  };

  const updateEditProduct = (idx, key, val) =>
    setEditForm((prev) => { const next = [...prev.products]; next[idx] = { ...next[idx], [key]: val }; return { ...prev, products: next }; });

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  const pStatus   = String(project?.status || "draft").toUpperCase();
  const statusMeta = STATUS_META[pStatus] || STATUS_META.DRAFT;
  const isDraft    = pStatus === "DRAFT";
  const isAdmin    = role === "ADMIN" || role === "SUPER_ADMIN";
  const isSuperAdmin = role === "SUPER_ADMIN";

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
        {isSidebarOpen && (
          <button type="button" className="sa-backdrop" onClick={() => setIsSidebarOpen(false)} aria-label="Close menu" />
        )}
        <aside className={`sa-sidebar ${isSidebarOpen ? "sa-sidebar--open" : ""}`}>
          <nav className="sa-nav">
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                type="button"
                className={`sa-nav-item ${item.key === "projects" ? "sa-nav-item--active" : ""}`}
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

        {/* ══ MAIN ══ */}
        <main className="sa-main">

          {/* ── Page header ── */}
          <div className="sa-page-head">
            <div className="sa-page-head-left">
              <div className="pd-breadcrumb">
                <button type="button" className="pd-breadcrumb-link" onClick={() => navigate("/projects/manage")}>
                  Projects
                </button>
                <span className="pd-breadcrumb-sep">/</span>
                <span>{project?.title || project?.name || "Details"}</span>
              </div>
              <h1 className="sa-page-title">
                {project?.title || project?.name || <span className="sa-highlight">Project Details</span>}
              </h1>
              <p className="sa-page-sub">Project details and products</p>
            </div>
            <div className="sa-page-actions">
              <button type="button" className="sa-export-btn" onClick={() => navigate("/projects/manage")}>
                <Icon name="arrowLeft" size={16} />
                <span>Back to Projects</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="sa-error">
              <Icon name="alert" size={16} /> {error}
              <button type="button" onClick={() => setError("")}>✕</button>
            </div>
          )}

          {loading && (
            <div className="sa-panel pd-loading">
              <div className="sa-spinner" />
              <p>Loading project details…</p>
            </div>
          )}

          {!loading && !project && !error && (
            <div className="sa-panel pd-loading">
              <Icon name="alert" size={28} />
              <p>Project not found.</p>
            </div>
          )}

          {!loading && project && (
            <>
              {/* ── Project info panel ── */}
              <div className="sa-panel">
                <div className="sa-panel-head">
                  <div>
                    <h2 className="sa-panel-title">Project Overview</h2>
                    <p className="sa-panel-sub">Core details and configuration</p>
                  </div>
                  <span className={`sa-status-badge ${statusMeta.cls}`}>{statusMeta.label}</span>
                </div>

                {/* Info grid */}
                <div className="pjd-info-grid">
                  {[
                    { icon: "tag",      label: "Category",    value: project.category || "—" },
                    { icon: "projects", label: "Mode",        value: project.mode || "—", isMode: true },
                    { icon: "budgets",  label: "Budget",      value: Number.isFinite(Number(project.reward)) ? fmtCurrency(project.reward) : "—", bold: true },
                    { icon: "calendar", label: "Start Date",  value: fmtDate(project.start_date) },
                    { icon: "calendar", label: "End Date",    value: fmtDate(project.end_date) },
                    { icon: "info",     label: "Description", value: project.description || "No description available.", full: true },
                  ].map((item) => (
                    <div key={item.label} className={`pjd-info-item ${item.full ? "pjd-info-item--full" : ""}`}>
                      <span className="pd-info-icon"><Icon name={item.icon} size={14} /></span>
                      <div>
                        <span className="pd-info-label">{item.label}</span>
                        {item.isMode ? (
                          <span className={`sa-mode-badge sa-mode-badge--${String(item.value || "").toLowerCase()}`}>{item.value}</span>
                        ) : (
                          <span className="pd-info-value" style={item.bold ? { color: "var(--green)", fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700 } : {}}>{item.value}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                {isAdmin && (
                  <div className="pjd-actions">
                    {isSuperAdmin && isDraft && (
                      <button
                        type="button"
                        className={`su-action-btn ${isEditing ? "su-action-btn--reject" : "su-action-btn--ghost"}`}
                        onClick={() => setIsEditing(v => !v)}
                      >
                        <Icon name="edit" size={14} />
                        <span>{isEditing ? "Cancel Edit" : "Edit Draft"}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="su-action-btn su-action-btn--approve"
                      onClick={() => onStatusChange("published")}
                      disabled={statusBusy || pStatus === "PUBLISHED"}
                    >
                      <Icon name="check" size={14} />
                      <span>{statusBusy ? "Updating…" : "Publish"}</span>
                    </button>
                    <button
                      type="button"
                      className="su-action-btn su-action-btn--ghost"
                      onClick={() => onStatusChange("archived")}
                      disabled={statusBusy || pStatus === "ARCHIVED"}
                    >
                      <Icon name="archive" size={14} />
                      <span>Archive</span>
                    </button>
                  </div>
                )}
              </div>

              {/* ── Edit Draft form ── */}
              {isSuperAdmin && isEditing && isDraft && (
                <div className="sa-panel">
                  <div className="sa-panel-head">
                    <div>
                      <h2 className="sa-panel-title">Edit Draft Project</h2>
                      <p className="sa-panel-sub">Changes will be saved as draft until published</p>
                    </div>
                    <Icon name="edit" size={18} />
                  </div>

                  <div className="pjd-edit-form">
                    <div className="pjd-form-grid">
                      <FormInput label="Project Title" placeholder="Project Title" value={editForm.title}
                        onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
                      <FormInput label="Category" placeholder="Category" value={editForm.category}
                        onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))} />
                      <FormInput label="Budget (INR)" type="number" placeholder="0" value={editForm.reward}
                        onChange={e => setEditForm(p => ({ ...p, reward: e.target.value }))} />
                      <FormSelect label="Mode" value={editForm.mode} onChange={e => setEditForm(p => ({ ...p, mode: e.target.value }))}>
                        <option value="MARKETPLACE">MARKETPLACE</option>
                        <option value="D2C">D2C</option>
                      </FormSelect>
                      <FormInput label="Start Date" type="date" value={editForm.start_date}
                        onChange={e => setEditForm(p => ({ ...p, start_date: e.target.value }))} />
                      <FormInput label="End Date" type="date" value={editForm.end_date}
                        onChange={e => setEditForm(p => ({ ...p, end_date: e.target.value }))} />
                      <FormInput label="Primary Product URL (optional)" placeholder="https://…" value={editForm.product_url}
                        onChange={e => setEditForm(p => ({ ...p, product_url: e.target.value }))}
                        style={{ gridColumn: "1 / -1" }}
                      />
                    </div>

                    <FormTextarea label="Description" placeholder="Project description…" value={editForm.description}
                      onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={3} />

                    <div className="pjd-products-section">
                      <div className="pjd-products-head">
                        <h4 className="sa-panel-title" style={{ fontSize: "0.9rem" }}>Products</h4>
                        <button type="button" className="su-action-btn su-action-btn--approve"
                          onClick={() => setEditForm(p => ({ ...p, products: [...p.products, { ...blankProduct }] }))}>
                          <Icon name="plus" size={13} /> Add Product
                        </button>
                      </div>

                      {editForm.products.map((prod, idx) => (
                        <div key={`ep-${idx}`} className="pjd-product-row">
                          <FormInput placeholder="Product Name" value={prod.name}
                            onChange={e => updateEditProduct(idx, "name", e.target.value)} />
                          <FormInput placeholder="Product URL" value={prod.product_url}
                            onChange={e => updateEditProduct(idx, "product_url", e.target.value)} />
                          <FormInput type="number" placeholder="Price (INR)" value={prod.price}
                            onChange={e => updateEditProduct(idx, "price", e.target.value)} />
                          <button type="button" className="su-action-btn su-action-btn--danger pjd-remove-btn"
                            onClick={() => setEditForm(p => ({ ...p, products: p.products.length > 1 ? p.products.filter((_, i) => i !== idx) : p.products }))}>
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="pjd-form-footer">
                      <button type="button" className="pj-create-btn" onClick={onSaveDraft} disabled={saveBusy}>
                        <Icon name="save" size={15} />
                        <span>{saveBusy ? "Saving…" : "Save Draft"}</span>
                      </button>
                      <button type="button" className="sa-export-btn" onClick={() => setIsEditing(false)} disabled={saveBusy}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Products table ── */}
              <div className="sa-panel sa-panel--table">
                <div className="sa-panel-head">
                  <div>
                    <h2 className="sa-panel-title">Project Products</h2>
                    <p className="sa-panel-sub">
                      {(project.project_products || []).length} product{(project.project_products || []).length !== 1 ? "s" : ""} in this project
                    </p>
                  </div>
                  <Icon name="package" size={18} />
                </div>

                <div className="sa-table-wrap" style={{ marginTop: 0 }}>
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        <th>Product URL</th>
                        <th>Price (INR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(project.project_products || []).length > 0 ? (
                        project.project_products.map((prod) => (
                          <tr key={prod.id} className="sa-table-row--clickable">
                            <td className="sa-td-main">{prod.name || "—"}</td>
                            <td>
                              {prod.product_url ? (
                                <a href={prod.product_url} target="_blank" rel="noreferrer" className="pd-ext-link">
                                  <Icon name="globe" size={12} /> Open Link
                                </a>
                              ) : <span className="sa-td-muted">—</span>}
                            </td>
                            <td className="sa-td-bold" style={{ color: "var(--green)" }}>
                              {fmtCurrency(prod.product_value || 0)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="sa-td-empty">
                            <div className="su-empty-state">
                              <Icon name="package" size={28} />
                              <p>No products found for this project.</p>
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

export default ProjectDetails;