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

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const integerFormatter = new Intl.NumberFormat("en-US");

const hasNumber = (value) => Number.isFinite(Number(value));
const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const formatMetricValue = (value) => {
  if (!hasNumber(value)) {
    return "No data from backend";
  }

  return integerFormatter.format(Number(value));
};

const formatDateInput = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const iconColor = "#08a4c8";

const Icon = ({ name, size = 18 }) => {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: iconColor, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

  if (name === "menu") return <svg {...common}><path d="M3 6h18M3 12h18M3 18h18" /></svg>;
  if (name === "close") return <svg {...common}><path d="M18 6 6 18M6 6l12 12" /></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
  if (name === "dashboard") return <svg {...common}><rect x="3" y="3" width="8" height="8" /><rect x="13" y="3" width="8" height="5" /><rect x="13" y="10" width="8" height="11" /><rect x="3" y="13" width="8" height="8" /></svg>;
  if (name === "participants") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (name === "projects") return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></svg>;
  if (name === "approvals") return <svg {...common}><path d="m9 12 2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>;
  if (name === "payouts") return <svg {...common}><path d="M3 7h18v10H3z" /><path d="M3 10h18M8 14h2" /></svg>;
  if (name === "reports") return <svg {...common}><path d="M4 19h16" /><path d="M7 16V8M12 16V5M17 16v-3" /></svg>;
  if (name === "support") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4.3 1.7c-.7.7-1.3 1.1-1.3 2.3" /><path d="M12 17h.01" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
};

const timeAgo = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  const units = [
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
    [1, "second"]
  ];

  for (const [size, label] of units) {
    const count = Math.floor(seconds / size);
    if (count >= 1) {
      return `${count} ${label}${count > 1 ? "s" : ""} ago`;
    }
  }

  return "Recently";
};

const fetchJson = async (path, token, signal) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    signal
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data;
};

const Dashboard = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState(null);
  const [activity, setActivity] = useState([]);
  const [approvalCounts, setApprovalCounts] = useState({
    total: 0,
    participants: 0,
    project_access_requests: 0,
    product_applications: 0,
    purchase_proofs: 0,
    review_submissions: 0,
    payouts: 0
  });
  const [projects, setProjects] = useState([]);
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

  const overviewRef = useRef(null);
  const reportsRef = useRef(null);
  const activityRef = useRef(null);
  const projectsRef = useRef(null);
  const supportRef = useRef(null);

  const navItems = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", icon: "dashboard", ref: overviewRef, path: "/dashboard" },
      { key: "participants", label: "Participants", icon: "participants", ref: overviewRef, path: "/super-admin/users" },
      { key: "projects", label: "Projects", icon: "projects", ref: projectsRef, path: "/projects/manage" },
      { key: "approvals", label: "Approvals", icon: "approvals", ref: overviewRef, path: "/admin/applications" },
      { key: "client_budgets", label: "Client Budgets", icon: "payouts", ref: activityRef, path: "/admin/client-budgets" },
      { key: "payouts", label: "Payouts", icon: "payouts", ref: activityRef, path: "/admin/payouts" },
      { key: "payout_history", label: "Payout History", icon: "reports", ref: activityRef, path: "/admin/payout-history" },
      { key: "reports", label: "Reports", icon: "reports", ref: reportsRef, path: "/super-admin/reports" },
      { key: "support", label: "Support", icon: "support", ref: supportRef, path: "/super-admin/support" }
    ],
    []
  );

  const dateQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (dateFilter.preset === "custom") {
      if (dateFilter.from) params.set("from", dateFilter.from);
      if (dateFilter.to) params.set("to", dateFilter.to);
    } else {
      params.set("preset", dateFilter.preset);
    }
    return params.toString();
  }, [dateFilter]);

  const dateFilterLabel = useMemo(() => {
    if (dateFilter.preset === "custom") {
      if (dateFilter.from && dateFilter.to) return `${dateFilter.from} to ${dateFilter.to}`;
      if (dateFilter.from) return `From ${dateFilter.from}`;
      if (dateFilter.to) return `To ${dateFilter.to}`;
      return "Custom Range";
    }

    if (dateFilter.preset === "today") return "Today";
    if (dateFilter.preset === "yesterday") return "Yesterday";
    if (dateFilter.preset === "last7days") return "Last 7 days";
    return "Last 30 days";
  }, [dateFilter]);

  useEffect(() => {
    const token = getStoredToken();

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const controller = new AbortController();

    const loadDashboard = async () => {
      setLoading(true);
      setError("");

      try {
        const backendUser = await verifyBackendUser(token);
        const role = backendUser?.role?.toUpperCase?.() || "";

        if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
          setUser(backendUser);
          setError("This dashboard is only available for admin users.");
          return;
        }

        setUser(backendUser);

        const [summaryRes, activityRes, approvalsRes, projectsRes, performanceRes, supportRes] = await Promise.all([
          fetchJson(`/admin/dashboard/summary?${dateQuery}`, token, controller.signal),
          fetchJson("/admin/activity?limit=3", token, controller.signal),
          fetchJson("/admin/approvals/count", token, controller.signal),
          fetchJson("/projects", token, controller.signal),
          fetchJson(`/admin/dashboard/project-performance?${dateQuery}`, token, controller.signal),
          fetchJson("/admin/analytics/support", token, controller.signal)
        ]);

        setSummary(summaryRes?.data || {});
        setActivity(activityRes?.data || []);
        setApprovalCounts(approvalsRes?.data || {});
        if (Array.isArray(projectsRes?.data)) {
          const published = projectsRes.data.filter(
            (project) => String(project?.status || "").toLowerCase() === "published"
          );
          setProjects(published.slice(0, 5));
        } else {
          setProjects([]);
        }
        setProjectPerformance(Array.isArray(performanceRes?.data) ? performanceRes.data : []);
        setSupportAnalytics(supportRes?.data || null);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        if (/token|unauthorized|expired|forbidden/i.test(err.message)) {
          clearStoredTokens();
          navigate("/login", { replace: true });
          return;
        }

        setError(err.message || "Unable to load dashboard data.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => controller.abort();
  }, [dateQuery, navigate]);

  useEffect(() => {
    const token = getStoredToken();

    if (!token || !searchTerm.trim()) {
      setSearchResults(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const query = encodeURIComponent(searchTerm.trim());
        const response = await fetchJson(`/admin/search?q=${query}`, token, controller.signal);
        setSearchResults(response?.data || null);
      } catch {
        setSearchResults(null);
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchTerm]);

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  const handleNavClick = (item) => {
    setActiveNav(item.key);
    setIsSidebarOpen(false);

    if (item.path) {
      navigate(item.path);
      return;
    }

    item.ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const applyDateFilter = () => {
    setDateFilter(draftDateFilter);
    setIsDatePickerOpen(false);
  };

  const handleExportApprovals = async () => {
    const token = getStoredToken();
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    setIsExporting(true);

    try {
      const res = await fetchJson("/admin/approvals", token);
      const rows = Array.isArray(res?.data) ? res.data : [];

      const header = "type,id,name,allocation_id,created_at";
      const body = rows
        .map((row) => {
          const values = [
            row.type || "",
            row.id || "",
            row.name || "",
            row.allocation_id || "",
            row.created_at || ""
          ];

          return values
            .map((value) => `"${String(value).replace(/"/g, "\"\"")}"`)
            .join(",");
        })
        .join("\n");

      const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `admin-approvals-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const cards = useMemo(
    () => [
      {
        title: "Total Participants",
        value: formatMetricValue(summary?.participants_total),
        note: "Backend data",
        icon: "participants",
        tone: "positive"
      },
      {
        title: "Active Projects",
        value: formatMetricValue(summary?.projects_active),
        note: "Backend data",
        icon: "projects",
        tone: "positive"
      },
      {
        title: "Pending Approvals",
        value: formatMetricValue(
          toNumber(approvalCounts?.participants)
          + toNumber(approvalCounts?.product_applications)
          + toNumber(approvalCounts?.purchase_proofs)
          + toNumber(approvalCounts?.review_submissions)
        ),
        note:
          `${toNumber(approvalCounts?.participants)} login`
          + ` + ${toNumber(approvalCounts?.product_applications)} products`
          + ` + ${toNumber(approvalCounts?.purchase_proofs) + toNumber(approvalCounts?.review_submissions)} review/invoices`,
        icon: "approvals",
        tone: "warning"
      },
      {
        title: "Pending Payout Batches",
        value: formatMetricValue(summary?.payouts_pending),
        note: "Backend data",
        icon: "payouts",
        tone: "positive"
      }
    ],
    [
      approvalCounts?.participants,
      approvalCounts?.product_applications,
      approvalCounts?.purchase_proofs,
      approvalCounts?.review_submissions,
      summary
    ]
  );

  const chartModel = useMemo(() => {
    const rows = Array.isArray(projectPerformance) ? projectPerformance : [];
    if (!rows.length) {
      return {
        hasData: false,
        xLabels: [],
        maxValue: 0,
        applicationsPoints: "",
        proofsPoints: "",
        applicationsSeries: [],
        proofsSeries: [],
        totals: { applications: 0, proofs: 0 }
      };
    }

    const applicationsSeries = rows.map((row) => Number(row?.samples || 0));
    const proofsSeries = rows.map((row) => {
      if (hasNumber(row?.reviews)) return Number(row.reviews);
      if (hasNumber(row?.value)) return Number(row.value);
      return 0;
    });
    const xLabels = rows.map((row, idx) => row?.label || `Week ${idx + 1}`);

    const maxValue = Math.max(
      1,
      ...applicationsSeries,
      ...proofsSeries
    );

    const xStart = 56;
    const xEnd = 560;
    const yBottom = 220;
    const yTop = 36;
    const divisor = Math.max(1, rows.length - 1);

    const buildPoints = (series) =>
      series
        .map((value, index) => {
          const x = xStart + (index * (xEnd - xStart)) / divisor;
          const y = yBottom - (value / maxValue) * (yBottom - yTop);
          return `${x},${y}`;
        })
        .join(" ");

    const buildAreaPoints = (linePoints) => {
      const segments = linePoints.split(" ").filter(Boolean);
      if (!segments.length) return "";
      const firstX = segments[0].split(",")[0];
      const lastX = segments[segments.length - 1].split(",")[0];
      return `${firstX},${yBottom} ${segments.join(" ")} ${lastX},${yBottom}`;
    };

    const applicationsPoints = buildPoints(applicationsSeries);
    const proofsPoints = buildPoints(proofsSeries);
    const applicationsTotal = applicationsSeries.reduce((sum, value) => sum + value, 0);
    const proofsTotal = proofsSeries.reduce((sum, value) => sum + value, 0);

    return {
      hasData: true,
      xLabels,
      maxValue,
      applicationsPoints,
      proofsPoints,
      applicationsAreaPoints: buildAreaPoints(applicationsPoints),
      proofsAreaPoints: buildAreaPoints(proofsPoints),
      applicationsSeries,
      proofsSeries,
      totals: {
        applications: applicationsTotal,
        proofs: proofsTotal
      },
      conversionRate: applicationsTotal > 0 ? Math.round((proofsTotal / applicationsTotal) * 100) : 0
    };
  }, [projectPerformance]);

  if (loading) {
    return <div className="admin-loading">Loading admin dashboard...</div>;
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-topbar">
        <button
          type="button"
          className="btn admin-menu-toggle"
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
        >
          <Icon name={isSidebarOpen ? "close" : "menu"} size={20} />
        </button>
        <div className="admin-brand">NITRO</div>
        <div className="admin-search-wrap">
          <input
            type="text"
            className="form-control admin-search"
            placeholder="Search data, reports, or users..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          {searchResults && searchTerm.trim() ? (
            <div className="admin-search-panel">
              <p className="admin-search-title">Participants</p>
              {(searchResults.participants || []).slice(0, 3).map((item) => (
                <div className="admin-search-item" key={item.id}>{item.full_name || item.email || item.id}</div>
              ))}
              <p className="admin-search-title mt-2">Projects</p>
              {(searchResults.projects || []).slice(0, 3).map((item) => (
                <div className="admin-search-item" key={item.id}>{item.title || item.id}</div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="admin-userbox">
          <span className="admin-role">{user?.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</span>
          <button type="button" className="btn btn-sm btn-light" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="admin-layout">
        {isSidebarOpen ? (
          <button
            type="button"
            className="admin-sidebar-backdrop"
            aria-label="Close navigation menu"
            onClick={() => setIsSidebarOpen(false)}
          />
        ) : null}
        <aside className={`admin-sidebar ${isSidebarOpen ? "open" : ""}`}>
          <ul className="admin-nav list-unstyled">
            {navItems.map((item) => (
              <li key={item.key} className={activeNav === item.key ? "active" : ""}>
                <button type="button" className="admin-nav-btn" onClick={() => handleNavClick(item)}>
                  <span className="admin-nav-main">
                    <span className="admin-nav-icon"><Icon name={item.icon} size={18} /></span>
                    <span>{item.label}</span>
                  </span>
                  {item.key === "approvals" ? (
                    <span className="badge text-bg-danger ms-2">
                      {
                        toNumber(approvalCounts?.participants)
                        + toNumber(approvalCounts?.product_applications)
                        + toNumber(approvalCounts?.purchase_proofs)
                        + toNumber(approvalCounts?.review_submissions)
                      }
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-primary admin-new-project"
            onClick={() => navigate("/projects/manage")}
          >
            + New Project
          </button>
        </aside>

        <main className="admin-main">
          <div className="admin-main-head" ref={overviewRef}>
            <div>
              <h1>Welcome back, Admin</h1>
              <p>Overview of Nitro activity and performance for the selected period.</p>
            </div>
            <div className="admin-actions">
              <div className="admin-date-picker-wrap">
                <button
                  type="button"
                  className="btn btn-light admin-date-trigger"
                  onClick={() => {
                    setDraftDateFilter(dateFilter);
                    setIsDatePickerOpen((prev) => !prev);
                  }}
                >
                  <Icon name="calendar" size={18} />
                  <span>{dateFilterLabel}</span>
                </button>
                {isDatePickerOpen ? (
                  <div className="admin-date-popover">
                    <div className="admin-date-presets">
                      {[
                        { label: "Today", preset: "today" },
                        { label: "Yesterday", preset: "yesterday" },
                        { label: "Last 7 days", preset: "last7days" },
                        { label: "Last 30 days", preset: "last30days" },
                        { label: "Custom range", preset: "custom" }
                      ].map((presetItem) => (
                        <button
                          key={presetItem.preset}
                          type="button"
                          className={`btn ${draftDateFilter.preset === presetItem.preset ? "btn-info" : "btn-outline-secondary"}`}
                          onClick={() =>
                            setDraftDateFilter((prev) => ({ ...prev, preset: presetItem.preset }))
                          }
                        >
                          {presetItem.label}
                        </button>
                      ))}
                    </div>
                    <div className="admin-date-inputs">
                      <label htmlFor="dateFrom" className="form-label mb-1">From</label>
                      <input
                        id="dateFrom"
                        type="date"
                        className="form-control"
                        value={draftDateFilter.from}
                        onChange={(event) =>
                          setDraftDateFilter((prev) => ({
                            ...prev,
                            preset: "custom",
                            from: event.target.value
                          }))
                        }
                        max={draftDateFilter.to || formatDateInput(new Date())}
                      />
                      <label htmlFor="dateTo" className="form-label mb-1 mt-2">To</label>
                      <input
                        id="dateTo"
                        type="date"
                        className="form-control"
                        value={draftDateFilter.to}
                        onChange={(event) =>
                          setDraftDateFilter((prev) => ({
                            ...prev,
                            preset: "custom",
                            to: event.target.value
                          }))
                        }
                        min={draftDateFilter.from || undefined}
                        max={formatDateInput(new Date())}
                      />
                    </div>
                    <div className="admin-date-actions">
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setIsDatePickerOpen(false)}>
                        Cancel
                      </button>
                      <button type="button" className="btn btn-info text-white" onClick={applyDateFilter}>
                        Apply
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <button type="button" className="btn btn-outline-secondary" onClick={handleExportApprovals} disabled={isExporting}>
                {isExporting ? "Exporting..." : "Export"}
              </button>
            </div>
          </div>

          {error ? <div className="alert alert-warning mb-3">{error}</div> : null}

          <section className="admin-cards">
            {cards.map((card) => (
              <article key={card.title} className="admin-stat-card">
                <div className="admin-stat-top">
                  <div className="admin-icon">
                    <Icon name={card.icon} size={20} />
                  </div>
                  <span className={`admin-delta ${card.tone}`}>{card.note}</span>
                </div>
                <p className="admin-stat-title">{card.title}</p>
                <h3>{card.value}</h3>
              </article>
            ))}
          </section>

          <section className="admin-panels" ref={reportsRef}>
            <article className="admin-panel chart-panel">
              <div className="panel-head">
                <h2>Project Performance</h2>
              </div>
              {chartModel.hasData ? (
                <>
                  <div className="chart-kpis">
                    <div className="chart-kpi">
                      <span className="chart-kpi-label">Applications</span>
                      <strong className="chart-kpi-value">{chartModel.totals.applications}</strong>
                    </div>
                    <div className="chart-kpi">
                      <span className="chart-kpi-label">Purchase Proofs</span>
                      <strong className="chart-kpi-value">{chartModel.totals.proofs}</strong>
                    </div>
                    <div className="chart-kpi">
                      <span className="chart-kpi-label">Conversion</span>
                      <strong className="chart-kpi-value">{chartModel.conversionRate}%</strong>
                    </div>
                  </div>
                  <svg viewBox="0 0 600 240" className="performance-chart" aria-label="Project performance chart">
                    <defs>
                      <linearGradient id="appsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5a7bff" stopOpacity="0.24" />
                        <stop offset="100%" stopColor="#5a7bff" stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="proofFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#11a6ca" stopOpacity="0.24" />
                        <stop offset="100%" stopColor="#11a6ca" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    <line x1="56" y1="220" x2="560" y2="220" stroke="#b7c9d3" strokeWidth="1.5" />
                    <line x1="56" y1="220" x2="56" y2="36" stroke="#b7c9d3" strokeWidth="1.5" />

                    {[0, 0.5, 1].map((step) => {
                      const y = 220 - step * (220 - 36);
                      const label = Math.round(step * chartModel.maxValue);
                      return (
                        <g key={`y-${step}`}>
                          <line x1="56" y1={y} x2="560" y2={y} stroke="#e2edf2" strokeWidth="1" />
                          <text x="48" y={y + 4} textAnchor="end" className="chart-axis-label">{label}</text>
                        </g>
                      );
                    })}

                    <polygon points={chartModel.applicationsAreaPoints} fill="url(#appsFill)" />
                    <polygon points={chartModel.proofsAreaPoints} fill="url(#proofFill)" />
                    <polyline fill="none" stroke="#5a7bff" strokeWidth="3" points={chartModel.applicationsPoints} />
                    <polyline fill="none" stroke="#11a6ca" strokeWidth="3" points={chartModel.proofsPoints} />

                    {chartModel.applicationsPoints.split(" ").map((point, index) => {
                      const [cx, cy] = point.split(",");
                      return (
                        <g key={`apps-${point}`}>
                          <circle cx={cx} cy={cy} r="5" fill="#5a7bff" />
                          <title>{`${chartModel.xLabels[index]}: Applications ${chartModel.applicationsSeries[index]}`}</title>
                        </g>
                      );
                    })}

                    {chartModel.proofsPoints.split(" ").map((point, index) => {
                      const [cx, cy] = point.split(",");
                      return (
                        <g key={`proof-${point}`}>
                          <circle cx={cx} cy={cy} r="5" fill="#11a6ca" />
                          <title>{`${chartModel.xLabels[index]}: Proofs ${chartModel.proofsSeries[index]}`}</title>
                        </g>
                      );
                    })}

                    {chartModel.xLabels.map((label, index) => {
                      const x = 56 + (index * (560 - 56)) / Math.max(1, chartModel.xLabels.length - 1);
                      return (
                        <text key={`x-${label}`} x={x} y="236" textAnchor="middle" className="chart-axis-label">{label}</text>
                      );
                    })}
                  </svg>
                  <div className="chart-legend">
                    <span><i className="dot dot-apps" /> Applications ({chartModel.totals.applications})</span>
                    <span><i className="dot dot-proofs" /> Purchase Proofs ({chartModel.totals.proofs})</span>
                  </div>
                  <p className="chart-help">
                    This chart compares weekly demand vs completion. If applications rise but proofs stay low, fulfillment quality or participant follow-through needs attention.
                  </p>
                </>
              ) : (
                <p className="text-muted mb-0">No project performance data returned from backend yet.</p>
              )}
            </article>

            <article className="admin-panel activity-panel" ref={activityRef}>
              <h2>Recent Activity</h2>
              <ul className="list-unstyled mb-0">
                {activity.length ? (
                  activity.slice(0, 3).map((item) => (
                    <li key={item.id} className="activity-item">
                      <p className="activity-title">{item.action || "Activity"}</p>
                      <p className="activity-message">{item.message || item.entity_type || "Update completed"}</p>
                      <span className="activity-time">{timeAgo(item.created_at)}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-muted small">No recent activity.</li>
                )}
              </ul>
              <button
                type="button"
                className="btn btn-outline-secondary mt-3"
                onClick={() => navigate("/super-admin/logs")}
              >
                View All Activity
              </button>
            </article>
          </section>

          <section className="admin-panel projects-panel mt-4" ref={projectsRef}>
            <div className="panel-head">
              <h2>Active Project Status</h2>
              <button
                type="button"
                className="btn btn-link text-decoration-none"
                onClick={() => navigate("/projects/manage")}
              >
                View All Projects
              </button>
            </div>
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Project Name</th>
                    <th>Created By</th>
                    <th>Mode</th>
                    <th>Reward</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.length ? (
                    projects.map((project) => (
                      <tr key={project.id}>
                        <td>{project.title || "Untitled"}</td>
                        <td>{project.created_by_name || project.created_by || "-"}</td>
                        <td>{project.mode || "No mode from backend"}</td>
                        <td>{hasNumber(project.reward) ? currencyFormatter.format(Number(project.reward)) : "No reward from backend"}</td>
                        <td>
                          <span className="badge text-bg-info text-uppercase">{project.status || "unknown"}</span>
                        </td>
                        <td>{project.created_at ? new Date(project.created_at).toLocaleDateString() : "No date from backend"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-muted">No projects found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-panel mt-4" ref={supportRef}>
            <div className="panel-head">
              <h2>Support Overview</h2>
            </div>
            {supportAnalytics ? (
              <div className="d-flex gap-4 flex-wrap">
                <p className="mb-0">
                  Open Tickets:{" "}
                  <strong>{hasNumber(supportAnalytics.open) ? integerFormatter.format(Number(supportAnalytics.open)) : "No data from backend"}</strong>
                </p>
                <p className="mb-0">
                  Closed Tickets:{" "}
                  <strong>{hasNumber(supportAnalytics.closed) ? integerFormatter.format(Number(supportAnalytics.closed)) : "No data from backend"}</strong>
                </p>
              </div>
            ) : (
              <p className="text-muted mb-0">No support analytics returned from backend yet.</p>
            )}
          </section>
        </main>
      </div>

    </div>
  );
};

export default Dashboard;
