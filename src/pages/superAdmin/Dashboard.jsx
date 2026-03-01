import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  API_BASE_URL,
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser
} from "../../lib/auth";
import "./Dashboard.css";

/* ─── Formatters ─────────────────────────────────────────────── */
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-US");
const hasNum = (v) => Number.isFinite(Number(v));
const toNum  = (v) => (hasNum(v) ? Number(v) : 0);
const fmtVal = (v) => (hasNum(v) ? num.format(Number(v)) : "—");
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDateInput = (date) => {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2,"0"), d = String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
};
const timeAgo = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const sec = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  for (const [size, label] of [[86400,"day"],[3600,"hour"],[60,"min"],[1,"sec"]]) {
    const c = Math.floor(sec / size);
    if (c >= 1) return `${c} ${label}${c > 1 ? "s" : ""} ago`;
  }
  return "Just now";
};

/* ─── Fetch ──────────────────────────────────────────────────── */
const fetchJson = async (path, token, signal) => {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
};

/* ─── SVG Icons ──────────────────────────────────────────────── */
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
    calendar:     <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>,
    export:       <svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
    menu:         <svg {...p}><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
    close:        <svg {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>,
    trending:     <svg {...p}><path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>,
    alert:        <svg {...p}><path d="m10.29 3.86-8.6 14.9A1 1 0 0 0 2.57 20h16.86a1 1 0 0 0 .88-1.24l-8.6-14.9a1 1 0 0 0-1.72 0z"/><path d="M12 9v4M12 17h.01"/></svg>,
    activity:     <svg {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    arrow:        <svg {...p}><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  };
  return icons[name] || <svg {...p}><circle cx="12" cy="12" r="9"/></svg>;
};

/* ─── Stat Card ──────────────────────────────────────────────── */
const StatCard = ({ title, value, note, icon, tone, onClick, delay = 0 }) => (
  <article
    className={`sa-stat-card sa-stat-card--${tone}`}
    style={{ animationDelay: `${delay}ms` }}
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
  >
    <div className="sa-stat-card-top">
      <div className={`sa-stat-icon sa-stat-icon--${tone}`}>
        <Icon name={icon} size={20} />
      </div>
      {note && <span className={`sa-stat-note sa-stat-note--${tone}`}>{note}</span>}
    </div>
    <p className="sa-stat-label">{title}</p>
    <div className="sa-stat-value">{value}</div>
  </article>
);

/* ─── Activity Item ──────────────────────────────────────────── */
const ActivityItem = ({ item }) => {
  const isApproved = /approved/i.test(item.action || "");
  const isSubmit   = /submitted|applied/i.test(item.action || "");
  const tone = isApproved ? "success" : isSubmit ? "info" : "neutral";
  return (
    <div className={`sa-activity-item sa-activity-item--${tone}`}>
      <div className={`sa-activity-dot sa-activity-dot--${tone}`} />
      <div className="sa-activity-body">
        <p className="sa-activity-action">{item.action || "Activity"}</p>
        <p className="sa-activity-msg">{item.message || item.entity_type || "Update"}</p>
        <span className="sa-activity-time">{timeAgo(item.created_at)}</span>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════════════ */
const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [summary, setSummary]     = useState(null);
  const [activity, setActivity]   = useState([]);
  const [approvalCounts, setApprovalCounts] = useState({ total:0, participants:0, product_applications:0, purchase_proofs:0, review_submissions:0, payouts:0 });
  const [projects, setProjects]   = useState([]);
  const [projectPerformance, setProjectPerformance] = useState([]);
  const [supportAnalytics, setSupportAnalytics] = useState(null);
  const [dateFilter, setDateFilter] = useState({ preset: "last30days", from: "", to: "" });
  const [draftDateFilter, setDraftDateFilter] = useState({ preset: "last30days", from: "", to: "" });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const datePickerRef = useRef(null);

  const navItems = useMemo(() => [
    { key: "dashboard",    label: "Dashboard",      icon: "dashboard",    path: "/dashboard" },
    { key: "participants", label: "Participants",    icon: "participants", path: "/super-admin/users" },
    { key: "projects",     label: "Projects",        icon: "projects",     path: "/projects/manage" },
    { key: "approvals",    label: "Approvals",       icon: "approvals",    path: "/admin/applications", badge: true },
    { key: "client_budgets", label: "Client Budgets", icon: "budgets",    path: "/admin/client-budgets" },
    { key: "payouts",      label: "Payouts",         icon: "payouts",      path: "/admin/payouts" },
    { key: "payout_history", label: "Payout History", icon: "history",    path: "/admin/payout-history" },
    { key: "reports",      label: "Reports",         icon: "reports",      path: "/super-admin/reports" },
    { key: "support",      label: "Support",         icon: "support",      path: "/super-admin/support" },
  ], []);

  const dateQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (dateFilter.preset === "custom") {
      if (dateFilter.from) p.set("from", dateFilter.from);
      if (dateFilter.to)   p.set("to",   dateFilter.to);
    } else { p.set("preset", dateFilter.preset); }
    return p.toString();
  }, [dateFilter]);

  const dateFilterLabel = useMemo(() => {
    const labels = { today: "Today", yesterday: "Yesterday", last7days: "Last 7 days", last30days: "Last 30 days" };
    if (dateFilter.preset !== "custom") return labels[dateFilter.preset] || "Last 30 days";
    if (dateFilter.from && dateFilter.to) return `${dateFilter.from} → ${dateFilter.to}`;
    return "Custom Range";
  }, [dateFilter]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) { navigate("/login", { replace: true }); return; }
    const ctrl = new AbortController();

    (async () => {
      setLoading(true); setError("");
      try {
        const bu = await verifyBackendUser(token);
        const role = bu?.role?.toUpperCase?.() || "";
        if (role !== "ADMIN" && role !== "SUPER_ADMIN") { setUser(bu); setError("Admin access only."); return; }
        setUser(bu);

        const [sumRes, actRes, appRes, projRes, perfRes, supRes] = await Promise.all([
          fetchJson(`/admin/dashboard/summary?${dateQuery}`, token, ctrl.signal),
          fetchJson("/admin/activity?limit=5", token, ctrl.signal),
          fetchJson("/admin/approvals/count", token, ctrl.signal),
          fetchJson("/projects", token, ctrl.signal),
          fetchJson(`/admin/dashboard/project-performance?${dateQuery}`, token, ctrl.signal),
          fetchJson("/admin/analytics/support", token, ctrl.signal),
        ]);

        setSummary(sumRes?.data || {});
        setActivity(actRes?.data || []);
        setApprovalCounts(appRes?.data || {});
        setProjects(Array.isArray(projRes?.data)
          ? projRes.data.filter(p => String(p?.status||"").toLowerCase() === "published").slice(0, 5)
          : []);
        setProjectPerformance(Array.isArray(perfRes?.data) ? perfRes.data : []);
        setSupportAnalytics(supRes?.data || null);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        if (/token|unauthorized|expired|forbidden/i.test(err.message)) { clearStoredTokens(); navigate("/login", { replace: true }); return; }
        setError(err.message || "Unable to load dashboard.");
      } finally { if (!ctrl.signal.aborted) setLoading(false); }
    })();
    return () => ctrl.abort();
  }, [dateQuery, navigate]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !searchTerm.trim()) { setSearchResults(null); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetchJson(`/admin/search?q=${encodeURIComponent(searchTerm.trim())}`, token, ctrl.signal);
        setSearchResults(r?.data || null);
      } catch { setSearchResults(null); }
    }, 350);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [searchTerm]);

  /* Close date picker on outside click */
  useEffect(() => {
    const handler = (e) => { if (datePickerRef.current && !datePickerRef.current.contains(e.target)) setIsDatePickerOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  const handleNavClick = (item) => {
    setActiveNav(item.key);
    setIsSidebarOpen(false);
    if (item.path) navigate(item.path);
  };

  const handleExport = async () => {
    const token = getStoredToken();
    if (!token) return;
    setIsExporting(true);
    try {
      const res = await fetchJson("/admin/approvals", token);
      const rows = Array.isArray(res?.data) ? res.data : [];
      const header = "type,id,name,allocation_id,created_at";
      const body = rows.map(r => ["type","id","name","allocation_id","created_at"].map(k => `"${String(r[k]||"").replace(/"/g,'""')}"`).join(",")).join("\n");
      const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `approvals-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (err) { setError(err.message || "Export failed."); }
    finally { setIsExporting(false); }
  };

  const totalApprovals = toNum(approvalCounts?.participants) + toNum(approvalCounts?.product_applications) + toNum(approvalCounts?.purchase_proofs) + toNum(approvalCounts?.review_submissions);

  const cards = useMemo(() => [
    { title: "Total Participants", value: fmtVal(summary?.participants_total), note: "Active users", icon: "participants", tone: "blue", path: "/super-admin/users" },
    { title: "Active Projects",    value: fmtVal(summary?.projects_active),    note: "Live campaigns", icon: "projects",     tone: "cyan", path: "/projects/manage" },
    { title: "Pending Approvals",  value: fmtVal(totalApprovals),
      note: `${toNum(approvalCounts?.participants)} logins · ${toNum(approvalCounts?.product_applications)} products · ${toNum(approvalCounts?.purchase_proofs)+toNum(approvalCounts?.review_submissions)} reviews`,
      icon: "approvals", tone: totalApprovals > 0 ? "amber" : "blue", path: "/admin/applications" },
    { title: "Pending Payouts",    value: fmtVal(summary?.payouts_pending),    note: "Batches queued", icon: "payouts",      tone: "green", path: "/admin/payouts" },
  ], [summary, approvalCounts, totalApprovals]);

  /* ─── Chart model ─── */
  const chart = useMemo(() => {
    const rows = Array.isArray(projectPerformance) ? projectPerformance : [];
    if (!rows.length) return { hasData: false };
    const apps   = rows.map(r => Number(r?.samples || 0));
    const proofs = rows.map(r => hasNum(r?.reviews) ? Number(r.reviews) : hasNum(r?.value) ? Number(r.value) : 0);
    const labels = rows.map((r, i) => r?.label || `W${i+1}`);
    const maxV   = Math.max(1, ...apps, ...proofs);
    const xS=56, xE=548, yB=200, yT=28, div=Math.max(1,rows.length-1);
    const pts = (series) => series.map((v,i) => `${xS+(i*(xE-xS)/div)},${yB-(v/maxV)*(yB-yT)}`).join(" ");
    const area = (line) => {
      const segs = line.split(" ").filter(Boolean);
      if (!segs.length) return "";
      return `${segs[0].split(",")[0]},${yB} ${segs.join(" ")} ${segs[segs.length-1].split(",")[0]},${yB}`;
    };
    const apts = pts(apps), ppts = pts(proofs);
    const appTotal = apps.reduce((s,v)=>s+v,0), proofTotal = proofs.reduce((s,v)=>s+v,0);
    return { hasData:true, labels, maxV, apps, proofs, apts, ppts, aapts:area(apts), papts:area(ppts),
      totals:{apps:appTotal, proofs:proofTotal}, conv:appTotal>0?Math.round((proofTotal/appTotal)*100):0 };
  }, [projectPerformance]);

  if (loading) {
    return (
      <div className="sa-loading">
        <div className="sa-loading-logo">NITRO</div>
        <div className="sa-spinner" />
        <p>Loading admin dashboard…</p>
      </div>
    );
  }

  return (
    <div className="sa-dashboard">
      {/* ══ TOPBAR ══ */}
      <header className="sa-topbar">
        <button type="button" className="sa-menu-btn" onClick={() => setIsSidebarOpen(v => !v)} aria-label="Toggle menu">
          <Icon name={isSidebarOpen ? "close" : "menu"} size={20} />
        </button>
        <div className="sa-brand">
          <span className="sa-brand-n">N</span>ITRO
        </div>

        <div className="sa-search-wrap">
          <span className="sa-search-icon"><Icon name="search" size={16} /></span>
          <input
            type="text"
            className="sa-search"
            placeholder="Search participants, projects, reports…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchResults && searchTerm.trim() && (
            <div className="sa-search-panel">
              {(searchResults.participants||[]).length > 0 && <>
                <p className="sa-search-cat">Participants</p>
                {(searchResults.participants||[]).slice(0,3).map(item => (
                  <div key={item.id} className="sa-search-item">{item.full_name || item.email}</div>
                ))}
              </>}
              {(searchResults.projects||[]).length > 0 && <>
                <p className="sa-search-cat">Projects</p>
                {(searchResults.projects||[]).slice(0,3).map(item => (
                  <div key={item.id} className="sa-search-item">{item.title}</div>
                ))}
              </>}
            </div>
          )}
        </div>

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
        {/* ══ SIDEBAR ══ */}
        {isSidebarOpen && (
          <button type="button" className="sa-backdrop" onClick={() => setIsSidebarOpen(false)} aria-label="Close menu" />
        )}
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
          <button
            type="button"
            className="sa-new-project-btn"
            onClick={() => navigate("/projects/manage")}
          >
            <span>+</span> New Project
          </button>
        </aside>

        {/* ══ MAIN CONTENT ══ */}
        <main className="sa-main">

          {/* ── Page header ── */}
          <div className="sa-page-head">
            <div className="sa-page-head-left">
              <h1 className="sa-page-title">
                Welcome back, <span className="sa-highlight">{user?.full_name?.split(" ")[0] || "Admin"}</span>
              </h1>
              <p className="sa-page-sub">Nitro platform overview · {dateFilterLabel}</p>
            </div>
            <div className="sa-page-actions">
              {/* Date picker */}
              <div className="sa-date-wrap" ref={datePickerRef}>
                <button
                  type="button"
                  className="sa-date-btn"
                  onClick={() => { setDraftDateFilter(dateFilter); setIsDatePickerOpen(v => !v); }}
                >
                  <Icon name="calendar" size={16} />
                  <span>{dateFilterLabel}</span>
                </button>
                {isDatePickerOpen && (
                  <div className="sa-date-popover">
                    <div className="sa-date-presets">
                      {[
                        { label: "Today",       preset: "today" },
                        { label: "Yesterday",   preset: "yesterday" },
                        { label: "Last 7 days", preset: "last7days" },
                        { label: "Last 30 days",preset: "last30days" },
                        { label: "Custom",      preset: "custom" },
                      ].map(p => (
                        <button
                          key={p.preset}
                          type="button"
                          className={`sa-preset-btn ${draftDateFilter.preset === p.preset ? "sa-preset-btn--active" : ""}`}
                          onClick={() => setDraftDateFilter(prev => ({ ...prev, preset: p.preset }))}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="sa-date-inputs">
                      <label className="sa-date-label">From
                        <input type="date" className="sa-date-input" value={draftDateFilter.from}
                          onChange={e => setDraftDateFilter(prev => ({ ...prev, preset:"custom", from:e.target.value }))}
                          max={draftDateFilter.to || fmtDateInput(new Date())}
                        />
                      </label>
                      <label className="sa-date-label">To
                        <input type="date" className="sa-date-input" value={draftDateFilter.to}
                          onChange={e => setDraftDateFilter(prev => ({ ...prev, preset:"custom", to:e.target.value }))}
                          min={draftDateFilter.from || undefined} max={fmtDateInput(new Date())}
                        />
                      </label>
                    </div>
                    <div className="sa-date-footer">
                      <button type="button" className="sa-date-cancel" onClick={() => setIsDatePickerOpen(false)}>Cancel</button>
                      <button type="button" className="sa-date-apply" onClick={() => { setDateFilter(draftDateFilter); setIsDatePickerOpen(false); }}>Apply</button>
                    </div>
                  </div>
                )}
              </div>
              <button type="button" className="sa-export-btn" onClick={handleExport} disabled={isExporting}>
                <Icon name="export" size={16} />
                <span>{isExporting ? "Exporting…" : "Export"}</span>
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="sa-error">
              <Icon name="alert" size={16} /> {error}
              <button type="button" onClick={() => setError("")}>✕</button>
            </div>
          )}

          {/* ── Stat cards ── */}
          <div className="sa-cards">
            {cards.map((card, i) => (
              <StatCard key={card.title} {...card} delay={i * 80} onClick={() => card.path && navigate(card.path)} />
            ))}
          </div>

          {/* ── Chart + Activity ── */}
          <div className="sa-panels">

            {/* Chart */}
            <div className="sa-panel sa-panel--chart">
              <div className="sa-panel-head">
                <div>
                  <h2 className="sa-panel-title">Project Performance</h2>
                  <p className="sa-panel-sub">Applications vs purchase proofs over time</p>
                </div>
              </div>

              {chart.hasData ? (
                <>
                  <div className="sa-kpis">
                    {[
                      { label: "Applications",    value: chart.totals.apps,  color: "#6366f1" },
                      { label: "Purchase Proofs", value: chart.totals.proofs, color: "#06b6d4" },
                      { label: "Conversion Rate", value: `${chart.conv}%`,   color: "#10b981" },
                    ].map(k => (
                      <div key={k.label} className="sa-kpi">
                        <span className="sa-kpi-dot" style={{ background: k.color }} />
                        <div>
                          <span className="sa-kpi-label">{k.label}</span>
                          <strong className="sa-kpi-val" style={{ color: k.color }}>{k.value}</strong>
                        </div>
                      </div>
                    ))}
                  </div>

                  <svg viewBox="0 0 600 228" className="sa-chart" aria-label="Performance chart">
                    <defs>
                      <linearGradient id="gApps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3"/>
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02"/>
                      </linearGradient>
                      <linearGradient id="gProofs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3"/>
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02"/>
                      </linearGradient>
                    </defs>
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map(step => {
                      const y = 200 - step * (200 - 28);
                      return <g key={step}>
                        <line x1="56" y1={y} x2="548" y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray={step===0?"none":"4 4"}/>
                        <text x="50" y={y+4} textAnchor="end" className="sa-chart-label">{Math.round(step*chart.maxV)}</text>
                      </g>;
                    })}
                    {/* Areas */}
                    <polygon points={chart.aapts} fill="url(#gApps)" />
                    <polygon points={chart.papts} fill="url(#gProofs)" />
                    {/* Lines */}
                    <polyline fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" points={chart.apts} />
                    <polyline fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinejoin="round" points={chart.ppts} />
                    {/* Dots */}
                    {chart.apts.split(" ").map((pt, i) => {
                      const [cx,cy] = pt.split(",");
                      return <g key={`a${i}`}><circle cx={cx} cy={cy} r="4" fill="#6366f1" stroke="#1a1f2e" strokeWidth="2"/><title>{chart.labels[i]}: {chart.apps[i]} applications</title></g>;
                    })}
                    {chart.ppts.split(" ").map((pt, i) => {
                      const [cx,cy] = pt.split(",");
                      return <g key={`p${i}`}><circle cx={cx} cy={cy} r="4" fill="#06b6d4" stroke="#1a1f2e" strokeWidth="2"/><title>{chart.labels[i]}: {chart.proofs[i]} proofs</title></g>;
                    })}
                    {/* X labels */}
                    {chart.labels.map((label, i) => {
                      const x = 56 + (i * (548-56)) / Math.max(1, chart.labels.length-1);
                      return <text key={label} x={x} y="220" textAnchor="middle" className="sa-chart-label">{label}</text>;
                    })}
                    {/* Axes */}
                    <line x1="56" y1="200" x2="548" y2="200" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
                    <line x1="56" y1="28"  x2="56"  y2="200" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
                  </svg>
                  <p className="sa-chart-note">
                    <Icon name="trending" size={14} />
                    If applications rise but proofs stay low, follow-through needs attention.
                  </p>
                </>
              ) : (
                <div className="sa-empty-chart">
                  <Icon name="reports" size={32} />
                  <p>No performance data yet for this period.</p>
                </div>
              )}
            </div>

            {/* Activity */}
            <div className="sa-panel sa-panel--activity">
              <div className="sa-panel-head">
                <div>
                  <h2 className="sa-panel-title">Recent Activity</h2>
                  <p className="sa-panel-sub">Latest platform events</p>
                </div>
                <Icon name="activity" size={18} />
              </div>

              <div className="sa-activity-list">
                {activity.length ? (
                  activity.slice(0, 5).map(item => <ActivityItem key={item.id} item={item} />)
                ) : (
                  <div className="sa-activity-empty">No recent activity.</div>
                )}
              </div>

              <button type="button" className="sa-view-all-btn" onClick={() => navigate("/super-admin/logs")}>
                View all activity <Icon name="arrow" size={14} />
              </button>
            </div>
          </div>

          {/* ── Projects table ── */}
          <div className="sa-panel sa-panel--table">
            <div className="sa-panel-head">
              <div>
                <h2 className="sa-panel-title">Active Projects</h2>
                <p className="sa-panel-sub">{projects.length} published campaigns</p>
              </div>
              <button type="button" className="sa-link-btn" onClick={() => navigate("/projects/manage")}>
                View all <Icon name="arrow" size={14} />
              </button>
            </div>

            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Created By</th>
                    <th>Mode</th>
                    <th>Reward</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.length ? projects.map(p => (
                    <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="sa-table-row--clickable">
                      <td className="sa-td-main">{p.title || "Untitled"}</td>
                      <td className="sa-td-muted">{p.created_by_name || p.created_by || "—"}</td>
                      <td><span className={`sa-mode-badge sa-mode-badge--${String(p.mode||"").toLowerCase()}`}>{p.mode || "—"}</span></td>
                      <td className="sa-td-bold">{hasNum(p.reward) ? inr.format(Number(p.reward)) : "—"}</td>
                      <td><span className="sa-status-badge sa-status-badge--published">{p.status || "—"}</span></td>
                      <td className="sa-td-muted">{fmtDate(p.created_at)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="sa-td-empty">No active projects found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Support + Quick links ── */}
          <div className="sa-bottom-row">
            <div className="sa-panel sa-panel--support">
              <div className="sa-panel-head">
                <div>
                  <h2 className="sa-panel-title">Support Overview</h2>
                  <p className="sa-panel-sub">Ticket status</p>
                </div>
                <Icon name="support" size={18} />
              </div>
              {supportAnalytics ? (
                <div className="sa-support-stats">
                  <div className="sa-support-stat sa-support-stat--open">
                    <span className="sa-support-num">{hasNum(supportAnalytics.open) ? num.format(Number(supportAnalytics.open)) : "0"}</span>
                    <span className="sa-support-label">Open Tickets</span>
                  </div>
                  <div className="sa-support-divider" />
                  <div className="sa-support-stat sa-support-stat--closed">
                    <span className="sa-support-num">{hasNum(supportAnalytics.closed) ? num.format(Number(supportAnalytics.closed)) : "0"}</span>
                    <span className="sa-support-label">Closed Tickets</span>
                  </div>
                </div>
              ) : (
                <p className="sa-muted">No support data available.</p>
              )}
            </div>

            <div className="sa-panel sa-panel--quicklinks">
              <div className="sa-panel-head">
                <div>
                  <h2 className="sa-panel-title">Quick Actions</h2>
                  <p className="sa-panel-sub">Common admin tasks</p>
                </div>
              </div>
              <div className="sa-quick-grid">
                {[
                  { label: "Review Approvals",   icon: "approvals",    path: "/admin/applications",  urgent: totalApprovals > 0 },
                  { label: "Process Payouts",    icon: "payouts",      path: "/admin/payouts" },
                  { label: "View Participants",  icon: "participants", path: "/super-admin/users" },
                  { label: "Check Reports",      icon: "reports",      path: "/super-admin/reports" },
                ].map(q => (
                  <button key={q.label} type="button" className={`sa-quick-btn ${q.urgent ? "sa-quick-btn--urgent" : ""}`} onClick={() => navigate(q.path)}>
                    <span className="sa-quick-icon"><Icon name={q.icon} size={20} /></span>
                    <span className="sa-quick-label">{q.label}</span>
                    {q.urgent && <span className="sa-quick-dot">{totalApprovals}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
};

export default Dashboard;