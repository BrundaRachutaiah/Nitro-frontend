import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  API_BASE_URL,
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser
} from "../../lib/auth";
import "../superAdmin/AdminPages.css";

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const fetchJson = async (path, token, signal) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
};

const fmt = (v) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));

const fmtDate = (v) => {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

/* ─── SVG icons (inline, no lib needed) ──────────────────────────────────── */
const Icon = {
  dashboard:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  create:      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>,
  projects:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18"/></svg>,
  approvals:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="3"/></svg>,
  budgets:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 6v2m0 8v2m-3-5h6"/></svg>,
  payouts:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 2H8M12 11v4m-2-2h4"/></svg>,
  history:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  search:      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  wallet:      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 13a1 1 0 1 0 2 0 1 1 0 0 0-2 0"/><path d="M6 6V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>,
  spent:       <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  remaining:   <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22V12m0 0-3 3m3-3 3 3M20 12A8 8 0 1 1 4 12a8 8 0 0 1 16 0Z"/></svg>,
  units:       <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg>,
  active:      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>,
};

/* ─── nav config ─────────────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { key: "dashboard",      label: "Dashboard",             icon: Icon.dashboard },
  { key: "create",         label: "Create Project",        icon: Icon.create    },
  { key: "manage",         label: "View All Projects",     icon: Icon.projects  },
  { key: "applications",   label: "Application Approvals", icon: Icon.approvals },
  { key: "client-budgets", label: "Client Budgets",        icon: Icon.budgets, active: true },
  { key: "payouts",        label: "Payouts",               icon: Icon.payouts   },
  { key: "payout-history", label: "Payout History",        icon: Icon.history   },
];

/* ════════════════════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════════════════════ */
const ClientBudgets = () => {
  const navigate = useNavigate();
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [projects, setProjects]   = useState([]);
  const [query, setQuery]         = useState("");
  const [statusFilter, setStatus] = useState("PUBLISHED");
  const [sortKey, setSortKey]     = useState("allocated_budget");
  const [sortDir, setSortDir]     = useState("desc");
  const [sidebarOpen, setSidebar] = useState(false);

  /* auth + load */
  useEffect(() => {
    const token = getStoredToken();
    if (!token) { navigate("/login", { replace: true }); return; }
    const ctrl = new AbortController();

    (async () => {
      setLoading(true); setError("");
      try {
        const me = await verifyBackendUser(token);
        const role = String(me?.role || "").toUpperCase();
        if (role !== "ADMIN" && role !== "SUPER_ADMIN") { navigate("/dashboard", { replace: true }); return; }
        setUser(me);
        const res = await fetchJson("/projects", token, ctrl.signal);
        setProjects(Array.isArray(res?.data) ? res.data : []);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        if (/token|unauthorized|expired|forbidden/i.test(e.message)) { clearStoredTokens(); navigate("/login", { replace: true }); return; }
        setError(e.message || "Unable to load budgets.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [navigate]);

  const handleLogout = async () => {
    await signOutFromSupabase(getStoredToken());
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  const navTo = (key) => {
    setSidebar(false);
    const map = {
      dashboard:        `/admin/${user?.id}/dashboard`,
      create:           "/projects/create",
      manage:           "/projects/manage",
      applications:     "/admin/applications",
      "client-budgets": "/admin/client-budgets",
      payouts:          "/admin/payouts",
      "payout-history": "/admin/payout-history",
    };
    navigate(map[key] || "/");
  };

  /* sort */
  const handleSort = (k) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  const SortArrow = ({ col }) =>
    sortKey !== col
      ? <span style={{ opacity: 0.2, marginLeft: 3, fontSize: 10 }}>↕</span>
      : <span style={{ color: "var(--accent)", marginLeft: 3, fontSize: 10 }}>{sortDir === "asc" ? "▲" : "▼"}</span>;

  /* derived data */
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return projects.filter((p) => {
      const t = String(p?.title || p?.name || "").toLowerCase();
      const c = String(p?.created_by_name || p?.created_by || "").toLowerCase();
      const s = String(p?.status || "").toUpperCase();
      return (!term || t.includes(term) || c.includes(term)) &&
             (statusFilter === "ALL" || s === statusFilter);
    });
  }, [projects, query, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = a[sortKey] ?? a.reward ?? 0;
      let bv = b[sortKey] ?? b.reward ?? 0;
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      return sortDir === "asc" ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
    });
  }, [filtered, sortKey, sortDir]);

  const stats = useMemo(() => {
    const active = projects.filter((p) => String(p?.status || "").toUpperCase() === "PUBLISHED");
    const totalBudget    = active.reduce((s, p) => s + Number(p?.allocated_budget ?? p?.reward ?? 0), 0);
    const totalSpent     = active.reduce((s, p) => s + Number(p?.spent_budget || 0), 0);
    const totalRemaining = active.reduce((s, p) => {
      const a = Number(p?.allocated_budget ?? p?.reward ?? 0);
      return s + Number(p?.remaining_budget ?? Math.max(0, a - Number(p?.spent_budget || 0)));
    }, 0);
    const totalUnits = active.reduce((s, p) => s + Number(p?.total_units || 0), 0);
    return { activeCount: active.length, totalBudget, totalSpent, totalRemaining, totalUnits };
  }, [projects]);

  const totals = useMemo(() => ({
    units:     sorted.reduce((s, p) => s + Number(p?.total_units || 0), 0),
    budget:    sorted.reduce((s, p) => s + Number(p?.allocated_budget ?? p?.reward ?? 0), 0),
    spent:     sorted.reduce((s, p) => s + Number(p?.spent_budget || 0), 0),
    remaining: sorted.reduce((s, p) => {
      const a = Number(p?.allocated_budget ?? p?.reward ?? 0);
      return s + Number(p?.remaining_budget ?? Math.max(0, a - Number(p?.spent_budget || 0)));
    }, 0),
  }), [sorted]);

  const initials = (name) => String(name || "A").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  /* ── loading ── */
  if (loading) return (
    <div className="sa-loading">
      <div className="sa-loading-logo">NITRO</div>
      <div className="sa-spinner" />
      <span>Loading client budgets…</span>
    </div>
  );

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="sa-dashboard">

      {/* ── TOPBAR ── */}
      <header className="sa-topbar">
        <button className="sa-menu-btn" onClick={() => setSidebar((o) => !o)} aria-label="Toggle menu">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 6h18M3 12h18M3 18h18"/>
          </svg>
        </button>

        <div className="sa-brand">
          <span className="sa-brand-n">N</span>ITRO
        </div>

        {/* search bar */}
        <div className="sa-search-wrap">
          <span className="sa-search-icon">{Icon.search}</span>
          <input
            className="sa-search"
            type="text"
            placeholder="Search project or client…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="sa-topbar-right">
          <div className="sa-user-pill">
            <div className="sa-user-avatar">{initials(user?.full_name)}</div>
            <div className="sa-user-info">
              <span className="sa-user-name">{user?.full_name || "Admin"}</span>
              <span className="sa-user-role">{user?.role || "Admin"}</span>
            </div>
          </div>
          <button className="sa-logout" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* ── LAYOUT ── */}
      <div className="sa-layout">

        {/* mobile backdrop */}
        {sidebarOpen && (
          <button className="sa-backdrop" onClick={() => setSidebar(false)} aria-label="Close menu" />
        )}

        {/* ── SIDEBAR ── */}
        <aside className={`sa-sidebar${sidebarOpen ? " sa-sidebar--open" : ""}`}>
          <nav className="sa-nav">
            {NAV_ITEMS.map(({ key, label, icon, active }) => (
              <button
                key={key}
                className={`sa-nav-item${active ? " sa-nav-item--active" : ""}`}
                onClick={() => navTo(key)}
              >
                <span className="sa-nav-icon">{icon}</span>
                <span className="sa-nav-label">{label}</span>
              </button>
            ))}
          </nav>

          <button className="sa-new-project-btn" onClick={() => navTo("create")}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New Project
          </button>
        </aside>

        {/* ── MAIN ── */}
        <main className="sa-main">

          {/* page header */}
          <div className="sa-page-head">
            <div>
              <h1 className="sa-page-title">
                Client <span className="sa-highlight">Budgets</span>
              </h1>
              <p className="sa-page-sub">
                Track allocated, spent &amp; remaining budgets across all projects.
              </p>
            </div>

            {/* status filter buttons */}
            <div className="sa-page-actions">
              {[
                { label: "All",     value: "ALL"       },
                { label: "Active",  value: "PUBLISHED" },
                { label: "Draft",   value: "DRAFT"     },
                { label: "Archived",value: "ARCHIVED"  },
              ].map((opt) => (
                <button
                  key={opt.value}
                  className="sa-export-btn"
                  style={statusFilter === opt.value ? {
                    background: "var(--accent-dim)",
                    borderColor: "rgba(99,102,241,0.4)",
                    color: "var(--accent)",
                  } : {}}
                  onClick={() => setStatus(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* error */}
          {error && (
            <div className="sa-error">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
              </svg>
              {error}
              <button onClick={() => setError("")}>✕</button>
            </div>
          )}

          {/* ── STAT CARDS ── */}
          <div className="sa-cards" style={{ gridTemplateColumns: "repeat(5, minmax(0,1fr))" }}>

            <div className="sa-stat-card sa-stat-card--blue" style={{ animationDelay: "0ms" }}>
              <div className="sa-stat-card-top">
                <div className="sa-stat-icon sa-stat-icon--blue">{Icon.active}</div>
                <span className="sa-stat-note sa-stat-note--blue">Running</span>
              </div>
              <div className="sa-stat-label">Active Projects</div>
              <div className="sa-stat-value">{stats.activeCount}</div>
            </div>

            <div className="sa-stat-card sa-stat-card--cyan" style={{ animationDelay: "60ms" }}>
              <div className="sa-stat-card-top">
                <div className="sa-stat-icon sa-stat-icon--cyan">{Icon.wallet}</div>
                <span className="sa-stat-note sa-stat-note--cyan">Total</span>
              </div>
              <div className="sa-stat-label">Allocated Budget</div>
              <div className="sa-stat-value" style={{ fontSize: "clamp(1.2rem,1.8vw,1.6rem)" }}>
                {fmt(stats.totalBudget)}
              </div>
            </div>

            <div className="sa-stat-card sa-stat-card--amber" style={{ animationDelay: "120ms" }}>
              <div className="sa-stat-card-top">
                <div className="sa-stat-icon sa-stat-icon--amber">{Icon.spent}</div>
                <span className="sa-stat-note sa-stat-note--amber">
                  {stats.totalBudget > 0 ? `${Math.round((stats.totalSpent / stats.totalBudget) * 100)}%` : "0%"}
                </span>
              </div>
              <div className="sa-stat-label">Total Spent</div>
              <div className="sa-stat-value" style={{ fontSize: "clamp(1.2rem,1.8vw,1.6rem)" }}>
                {fmt(stats.totalSpent)}
              </div>
            </div>

            <div className="sa-stat-card sa-stat-card--green" style={{ animationDelay: "180ms" }}>
              <div className="sa-stat-card-top">
                <div className="sa-stat-icon sa-stat-icon--green">{Icon.remaining}</div>
                <span className="sa-stat-note sa-stat-note--green">Available</span>
              </div>
              <div className="sa-stat-label">Remaining</div>
              <div className="sa-stat-value" style={{ fontSize: "clamp(1.2rem,1.8vw,1.6rem)" }}>
                {fmt(stats.totalRemaining)}
              </div>
            </div>

            <div className="sa-stat-card sa-stat-card--blue" style={{ animationDelay: "240ms" }}>
              <div className="sa-stat-card-top">
                <div className="sa-stat-icon sa-stat-icon--blue">{Icon.units}</div>
                <span className="sa-stat-note sa-stat-note--blue">Active</span>
              </div>
              <div className="sa-stat-label">Total Units</div>
              <div className="sa-stat-value">{stats.totalUnits.toLocaleString("en-IN")}</div>
            </div>

          </div>

          {/* ── TABLE PANEL ── */}
          <div className="sa-panel sa-panel--table">
            <div className="sa-panel-head">
              <div>
                <div className="sa-panel-title">Project Budget Breakdown</div>
                <div className="sa-panel-sub">
                  {sorted.length} project{sorted.length !== 1 ? "s" : ""} · sorted by {sortKey.replace("_", " ")} {sortDir === "desc" ? "↓" : "↑"}
                </div>
              </div>
            </div>

            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th onClick={() => handleSort("title")} style={{ cursor: "pointer" }}>
                      Project Name <SortArrow col="title" />
                    </th>
                    <th onClick={() => handleSort("created_by_name")} style={{ cursor: "pointer" }}>
                      Client / Created By <SortArrow col="created_by_name" />
                    </th>
                    <th onClick={() => handleSort("mode")} style={{ cursor: "pointer" }}>
                      Mode <SortArrow col="mode" />
                    </th>
                    <th onClick={() => handleSort("status")} style={{ cursor: "pointer" }}>
                      Status <SortArrow col="status" />
                    </th>
                    <th onClick={() => handleSort("start_date")} style={{ cursor: "pointer" }}>
                      Start Date <SortArrow col="start_date" />
                    </th>
                    <th onClick={() => handleSort("end_date")} style={{ cursor: "pointer" }}>
                      End Date <SortArrow col="end_date" />
                    </th>
                    <th style={{ textAlign: "right", cursor: "pointer" }} onClick={() => handleSort("total_units")}>
                      Units <SortArrow col="total_units" />
                    </th>
                    <th style={{ textAlign: "right", cursor: "pointer" }} onClick={() => handleSort("allocated_budget")}>
                      Allocated <SortArrow col="allocated_budget" />
                    </th>
                    <th style={{ textAlign: "right", cursor: "pointer" }} onClick={() => handleSort("spent_budget")}>
                      Spent <SortArrow col="spent_budget" />
                    </th>
                    <th style={{ textAlign: "right", cursor: "pointer" }} onClick={() => handleSort("remaining_budget")}>
                      Remaining <SortArrow col="remaining_budget" />
                    </th>
                    <th>Utilisation</th>
                  </tr>
                </thead>

                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="sa-td-empty">
                        No projects found. Try adjusting your filters.
                      </td>
                    </tr>
                  ) : (
                    sorted.map((p, idx) => {
                      const alloc     = Number(p.allocated_budget ?? p.reward ?? 0);
                      const spent     = Number(p.spent_budget || 0);
                      const remaining = Number(p.remaining_budget ?? Math.max(0, alloc - spent));
                      const pct       = alloc > 0 ? Math.min((spent / alloc) * 100, 100) : 0;
                      const barColor  = pct > 85 ? "var(--danger)" : pct > 60 ? "var(--amber)" : "var(--green)";

                      const st = String(p.status || "").toLowerCase();
                      const md = String(p.mode  || "").toLowerCase();

                      return (
                        <tr key={p.id} className="sa-table-row--clickable">
                          <td className="sa-td-muted" style={{ textAlign: "center" }}>{idx + 1}</td>

                          <td>
                            <div className="sa-td-main">{p.title || p.name || "Untitled"}</div>
                            {p.category && (
                              <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: 2 }}>
                                {p.category}
                              </div>
                            )}
                          </td>

                          <td>{p.created_by_name || <span className="sa-td-muted">—</span>}</td>

                          <td>
                            <span className={`sa-mode-badge sa-mode-badge--${md || "draft"}`}>
                              {p.mode || "—"}
                            </span>
                          </td>

                          <td>
                            <span className={`sa-status-badge sa-status-badge--${st || "draft"}`}>
                              {p.status || "—"}
                            </span>
                          </td>

                          <td className="sa-td-muted">{fmtDate(p.start_date)}</td>
                          <td className="sa-td-muted">{fmtDate(p.end_date)}</td>

                          <td style={{ textAlign: "right" }}>
                            <span className="sa-td-bold">
                              {p.total_units != null ? Number(p.total_units).toLocaleString("en-IN") : "—"}
                            </span>
                          </td>

                          <td style={{ textAlign: "right" }}>
                            <span className="sa-td-bold" style={{ color: alloc > 0 ? "var(--text)" : "var(--text-3)" }}>
                              {alloc > 0 ? fmt(alloc) : "—"}
                            </span>
                          </td>

                          <td style={{ textAlign: "right" }}>
                            <span className="sa-td-bold" style={{ color: spent > 0 ? "var(--amber)" : "var(--text-3)" }}>
                              {spent > 0 ? fmt(spent) : "—"}
                            </span>
                          </td>

                          <td style={{ textAlign: "right" }}>
                            <span className="sa-td-bold"
                              style={{ color: remaining > 0 ? "var(--green)" : alloc > 0 ? "var(--danger)" : "var(--text-3)" }}>
                              {alloc > 0 ? fmt(remaining) : "—"}
                            </span>
                          </td>

                          {/* utilisation bar */}
                          <td style={{ minWidth: 120 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{
                                flex: 1, height: 5, borderRadius: 10,
                                background: "var(--bg-3)", overflow: "hidden",
                              }}>
                                <div style={{
                                  height: "100%", borderRadius: 10,
                                  width: `${pct}%`, background: barColor,
                                  transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
                                }} />
                              </div>
                              <span style={{ fontSize: "0.72rem", color: "var(--text-3)", minWidth: 30, textAlign: "right" }}>
                                {Math.round(pct)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* totals footer */}
                {sorted.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={7}
                        style={{ padding: "11px 12px", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-2)", borderTop: "1px solid var(--border)" }}>
                        Total ({sorted.length} project{sorted.length !== 1 ? "s" : ""})
                      </td>
                      <td style={{ textAlign: "right", padding: "11px 12px", fontWeight: 700, color: "var(--text-2)", borderTop: "1px solid var(--border)" }}>
                        {totals.units.toLocaleString("en-IN")}
                      </td>
                      <td style={{ textAlign: "right", padding: "11px 12px", fontWeight: 800, color: "var(--text)", fontFamily: "'Plus Jakarta Sans',sans-serif", borderTop: "1px solid var(--border)" }}>
                        {fmt(totals.budget)}
                      </td>
                      <td style={{ textAlign: "right", padding: "11px 12px", fontWeight: 800, color: "var(--amber)", fontFamily: "'Plus Jakarta Sans',sans-serif", borderTop: "1px solid var(--border)" }}>
                        {fmt(totals.spent)}
                      </td>
                      <td style={{ textAlign: "right", padding: "11px 12px", fontWeight: 800, color: "var(--green)", fontFamily: "'Plus Jakarta Sans',sans-serif", borderTop: "1px solid var(--border)" }}>
                        {fmt(totals.remaining)}
                      </td>
                      <td style={{ borderTop: "1px solid var(--border)" }} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* footer note */}
          <p style={{ fontSize: "0.75rem", color: "var(--text-3)", textAlign: "right", marginTop: -8 }}>
            Budgets derived from project reward · Spent = approved / purchased / completed allocations
          </p>

        </main>
      </div>
    </div>
  );
};

export default ClientBudgets;