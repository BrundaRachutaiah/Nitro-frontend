import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getBrandProjects } from "../../api/brand.api";
import {
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser,
} from "../../lib/auth";
import "../superAdmin/Dashboard.css";

/* ─── Formatters ── */
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const fmtCurrency = (v) => inr.format(Number(v || 0));
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

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
    plus:         <svg {...p}><path d="M12 5v14M5 12h14"/></svg>,
    alert:        <svg {...p}><path d="m10.29 3.86-8.6 14.9A1 1 0 0 0 2.57 20h16.86a1 1 0 0 0 .88-1.24l-8.6-14.9a1 1 0 0 0-1.72 0z"/><path d="M12 9v4M12 17h.01"/></svg>,
    filter:       <svg {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
    arrow:        <svg {...p}><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
    arrowLeft:    <svg {...p}><path d="M19 12H5M12 5l-7 7 7 7"/></svg>,
    tag:          <svg {...p}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    calendar:     <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>,
    package:      <svg {...p}><path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>,
    trending:     <svg {...p}><path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>,
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

/* ─── Project card gradient pool ── */
const GRADIENTS = [
  "linear-gradient(135deg, #1a2a4a 0%, #0e7490 100%)",
  "linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)",
  "linear-gradient(135deg, #14532d 0%, #059669 100%)",
  "linear-gradient(135deg, #431407 0%, #ea580c 100%)",
  "linear-gradient(135deg, #1a1a2e 0%, #7c3aed 100%)",
  "linear-gradient(135deg, #0f172a 0%, #0891b2 100%)",
];
const getGradient = (id) => GRADIENTS[String(id || "").charCodeAt(0) % GRADIENTS.length];

const STATUS_STYLES = {
  PUBLISHED: { dot: "var(--green)",  bg: "var(--green-dim)",  text: "#6ee7b7", label: "Published" },
  DRAFT:     { dot: "var(--text-3)", bg: "rgba(100,116,139,0.15)", text: "#94a3b8", label: "Draft" },
  ARCHIVED:  { dot: "var(--amber)",  bg: "var(--amber-dim)",  text: "#fcd34d", label: "Archived" },
};

/* ════════════════════════════════════════════
   MAIN — Projects List
════════════════════════════════════════════ */
const Projects = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isBrand   = location.pathname === "/brand/projects";

  const [user, setUser]       = useState(null);
  const [projects, setProjects] = useState([]);
  const [query, setQuery]     = useState("");
  const [mode, setMode]       = useState("ALL");
  const [status, setStatus]   = useState("ALL");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(true);
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

  /* ── Load projects ── */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getBrandProjects();
        setProjects(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load projects.");
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  /* ── Filter ── */
  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const name = String(p?.title || p?.name || "").toLowerCase();
      const pMode   = String(p?.mode || "MARKETPLACE").toUpperCase();
      const pStatus = String(p?.status || "draft").toUpperCase();
      return (
        (!query.trim() || name.includes(query.trim().toLowerCase())) &&
        (mode === "ALL" || pMode === mode) &&
        (status === "ALL" || pStatus === status)
      );
    });
  }, [projects, query, mode, status]);

  /* ── Summary counts ── */
  const counts = useMemo(() => ({
    total:     projects.length,
    published: projects.filter(p => String(p?.status || "").toUpperCase() === "PUBLISHED").length,
    draft:     projects.filter(p => String(p?.status || "").toUpperCase() === "DRAFT").length,
    archived:  projects.filter(p => String(p?.status || "").toUpperCase() === "ARCHIVED").length,
  }), [projects]);

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
            placeholder="Search by project name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="sa-topbar-right">
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
              <h1 className="sa-page-title">
                Active <span className="sa-highlight">Projects</span>
              </h1>
              <p className="sa-page-sub">Manage and monitor your product sampling campaigns</p>
            </div>
            {!isBrand && (
              <div className="sa-page-actions">
                <button type="button" className="sa-export-btn" onClick={() => navigate("/dashboard")}>
                  <Icon name="arrowLeft" size={16} />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  className="pj-create-btn"
                  onClick={() => navigate("/projects/create")}
                >
                  <Icon name="plus" size={16} />
                  <span>Create Project</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="sa-error">
              <Icon name="alert" size={16} /> {error}
              <button type="button" onClick={() => setError("")}>✕</button>
            </div>
          )}

          {/* ── Stat cards ── */}
          <div className="sa-cards">
            {[
              { title: "Total Projects",  value: counts.total,     icon: "projects", tone: "blue",  note: "All campaigns" },
              { title: "Published",       value: counts.published,  icon: "trending", tone: "green", note: "Live now" },
              { title: "Draft",           value: counts.draft,      icon: "tag",      tone: "cyan",  note: "In progress" },
              { title: "Archived",        value: counts.archived,   icon: "history",  tone: "amber", note: "Ended" },
            ].map((card, i) => (
              <article
                key={card.title}
                className={`sa-stat-card sa-stat-card--${card.tone}`}
                style={{ animationDelay: `${i * 80}ms` }}
                onClick={() => setStatus(card.title === "Total Projects" ? "ALL" : card.title.toUpperCase())}
                role="button" tabIndex={0}
              >
                <div className="sa-stat-card-top">
                  <div className={`sa-stat-icon sa-stat-icon--${card.tone}`}><Icon name={card.icon} size={20} /></div>
                  <span className={`sa-stat-note sa-stat-note--${card.tone}`}>{card.note}</span>
                </div>
                <p className="sa-stat-label">{card.title}</p>
                <div className="sa-stat-value">{card.value}</div>
              </article>
            ))}
          </div>

          {/* ── Filters + count ── */}
          <div className="pj-filter-bar">
            <div className="pj-filter-left">
              <Icon name="filter" size={14} style={{ color: "var(--text-3)" }} />
              <select className="pj-select" value={mode} onChange={e => setMode(e.target.value)}>
                <option value="ALL">Mode: All</option>
                <option value="MARKETPLACE">Marketplace</option>
                <option value="D2C">D2C</option>
              </select>
              <select className="pj-select" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="ALL">Status: All</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <span className="su-result-count">{filtered.length} project{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {/* ── Loading ── */}
          {loading && (
            <div className="sa-panel pd-loading">
              <div className="sa-spinner" />
              <p>Loading projects…</p>
            </div>
          )}

          {/* ── Project grid ── */}
          {!loading && (
            <div className="pj-grid">
              {filtered.length === 0 ? (
                <div className="sa-panel pj-empty">
                  <Icon name="package" size={36} />
                  <p>No projects match your filters.</p>
                  <button type="button" className="sa-link-btn" onClick={() => { setQuery(""); setMode("ALL"); setStatus("ALL"); }}>
                    Clear filters <Icon name="arrow" size={14} />
                  </button>
                </div>
              ) : (
                filtered.map((project) => {
                  const title     = project?.title || project?.name || "Untitled Project";
                  const pMode     = String(project?.mode || "MARKETPLACE").toUpperCase();
                  const pStatus   = String(project?.status || "draft").toUpperCase();
                  const styleMap  = STATUS_STYLES[pStatus] || STATUS_STYLES.DRAFT;
                  const gradient  = getGradient(project.id);

                  return (
                    <article
                      key={project.id || title}
                      className="pj-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/projects/manage/${project.id}`)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/projects/manage/${project.id}`); } }}
                    >
                      {/* Card image / gradient hero */}
                      <div className="pj-card-img" style={{ background: gradient }}>
                        <div className="pj-card-img-overlay" />
                        {/* Mode badge on image */}
                        <span className={`pj-mode-badge pj-mode-badge--${pMode.toLowerCase()}`}>{pMode}</span>
                        {/* Status indicator */}
                        <div className="pj-status-pill" style={{ background: styleMap.bg, color: styleMap.text }}>
                          <span className="pj-status-dot" style={{ background: styleMap.dot }} />
                          {styleMap.label}
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="pj-card-body">
                        <h3 className="pj-card-title">{title}</h3>
                        {project.category && (
                          <span className="pj-card-category">{project.category}</span>
                        )}
                        <div className="pj-card-meta">
                          {project.start_date && (
                            <span className="pj-card-meta-item">
                              <Icon name="calendar" size={12} />
                              {fmtDate(project.start_date)}
                            </span>
                          )}
                          <span className="pj-card-budget">
                            {Number.isFinite(Number(project.reward)) ? fmtCurrency(project.reward) : "TBD"}
                          </span>
                        </div>
                        <div className="pj-card-footer">
                          <span className="pj-card-products">
                            <Icon name="package" size={12} />
                            {(project.project_products || []).length} product{(project.project_products || []).length !== 1 ? "s" : ""}
                          </span>
                          <span className="pj-card-arrow"><Icon name="arrow" size={14} /></span>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default Projects;