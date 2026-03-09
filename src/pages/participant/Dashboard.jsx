import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  API_BASE_URL,
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser
} from "../../lib/auth";
import { getActiveCatalog } from "../../api/project.api";
import "./Dashboard.css";

/* ─── Fetch helper ─────────────────────────────────────────── */
const fetchJson = async (path, token, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    method: options.method || "GET",
    body: options.body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Request failed");
  return data;
};

const getPreviewImage = (primaryUrl, fallbackSeed = "nitro-product") => {
  const trimmed = String(primaryUrl || "").trim();
  if (trimmed) {
    if (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(trimmed)) return trimmed;
    try {
      const hostname = new URL(trimmed).hostname;
      if (hostname) return `https://logo.clearbit.com/${hostname}`;
    } catch { /* ignore */ }
  }
  return `https://picsum.photos/seed/${encodeURIComponent(fallbackSeed)}/400/300`;
};

const getLatestProductApplication = (appliedProjects, productId) => {
  if (!productId || !Array.isArray(appliedProjects)) return null;
  const matches = appliedProjects.filter((row) => {
    const pid = row?.product_id || row?.project_products?.id;
    return pid === productId;
  });
  if (!matches.length) return null;
  matches.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  return matches[0];
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const formatInr = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(amount);
};

const openProductLink = (url) => {
  const raw = String(url || "").trim();
  if (!raw) return;
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  window.open(normalized, "_blank", "noopener,noreferrer");
};

/* ─────────────────────────────────────────────────────────────
   STRICT STATUS RESOLVER
   Priority order: COMPLETED → CANCELLED → PURCHASED → APPROVED → PENDING → REJECTED → FRESH
   Only ONE state is ever true at a time.
───────────────────────────────────────────────────────────── */
const resolveCardState = (latestApplication) => {
  if (!latestApplication) return "FRESH";
  const app = String(latestApplication?.status || "").toUpperCase();
  const alloc = String(latestApplication?.allocation?.status || "").toUpperCase();

  // Completed beats everything
  if (app === "COMPLETED" || alloc === "COMPLETED") return "COMPLETED";
  // Cancelled allocation must allow re-apply (not task flow)
  if (app === "CANCELLED" || alloc === "CANCELLED") return "CANCELLED";
  // Purchased = product in hand, task ongoing
  if (app === "PURCHASED") return "PURCHASED";
  // Approved = admin said yes
  if (app === "APPROVED") return "APPROVED";
  // Pending = waiting
  if (app === "PENDING") return "PENDING";
  // Rejected
  if (app === "REJECTED") return "REJECTED";
  // Never applied
  return "FRESH";
};

/* ─── Toast system ─────────────────────────────────────────── */
let _toastId = 0;

const ToastContainer = ({ toasts, onDismiss }) => (
  <div className="nd-toast-container">
    {toasts.map((t) => (
      <div key={t.id} className={`nd-toast nd-toast--${t.type}`}>
        <div className="nd-toast-icon-wrap">
          {t.type === "success" && "✓"}
          {t.type === "error"   && "✕"}
          {t.type === "warning" && "!"}
          {t.type === "info"    && "i"}
        </div>
        <p className="nd-toast-msg">{t.message}</p>
        <button type="button" className="nd-toast-close" onClick={() => onDismiss(t.id)}>✕</button>
      </div>
    ))}
  </div>
);

/* ─── Status badge (for list tabs) ────────────────────────── */
const StatusBadge = ({ status }) => {
  const map = {
    PENDING:   ["Pending Review", "badge--pending"],
    APPROVED:  ["Approved",       "badge--approved"],
    REJECTED:  ["Rejected",       "badge--rejected"],
    CANCELLED: ["Cancelled",      "badge--rejected"],
    PURCHASED: ["In Progress",    "badge--purchased"],
    COMPLETED: ["Completed",      "badge--completed"],
  };
  const [label, cls] = map[status] || [status, "badge--default"];
  return <span className={`nd-badge ${cls}`}>{label}</span>;
};

/* ─────────────────────────────────────────────────────────────
   PRODUCT CARD — exactly ONE status pill, ONE action button
───────────────────────────────────────────────────────────── */
const CARD_META = {
  FRESH:     { pill: null,                                            pillCls: "",                      canSelect: true,  canTask: false },
  PENDING:   { pill: "⏳  Awaiting Admin Approval",                  pillCls: "nd-pill--pending",      canSelect: false, canTask: false },
  APPROVED:  { pill: "✓  Product Allocated to You",                  pillCls: "nd-pill--active",       canSelect: false, canTask: true  },
  CANCELLED: { pill: "✕  Allocation Cancelled",                      pillCls: "nd-pill--rejected",     canSelect: true,  canTask: false },
  PURCHASED: { pill: "🛍  Product Purchased — Complete Your Tasks",   pillCls: "nd-pill--purchased",    canSelect: false, canTask: true  },
  REJECTED:  { pill: "✕  Request Rejected",                          pillCls: "nd-pill--rejected",     canSelect: true,  canTask: false },
  COMPLETED: { pill: "★  Completed",                                  pillCls: "nd-pill--done",         canSelect: true,  canTask: false },
};

const ProductCard = ({ item, isSelected, latestApplication, onSelect, onNavigate, addToast }) => {
  const cardState = resolveCardState(latestApplication);
  const { pill, pillCls, canSelect, canTask } = CARD_META[cardState];

  const actionLabel = () => {
    if (isSelected) return "✓ Selected";
    if (cardState === "COMPLETED") return "Request Again";
    if (cardState === "CANCELLED") return "Request Again";
    if (cardState === "REJECTED")  return "Send New Request";
    return "Select Product";
  };

  const handleSelect = (e) => {
    e.stopPropagation();
    const wasSelected = isSelected;
    onSelect(item.selection_key);
    if (!wasSelected) {
      addToast(`"${item?.name?.slice(0, 40) || "Product"}" added to your request list.`, "info");
    } else {
      addToast(`"${item?.name?.slice(0, 40) || "Product"}" removed from your list.`, "info");
    }
  };

  const handleTask = (e) => {
    e.stopPropagation();
    addToast("Opening your task for this product…", "info");
    const allocId = latestApplication?.allocation?.id;
    onNavigate(allocId);
  };

  return (
    <article
      className={[
        "nd-product-card",
        isSelected ? "nd-product-card--selected" : "",
        cardState === "PENDING"   ? "nd-product-card--pending"   : "",
        cardState === "APPROVED"  ? "nd-product-card--active"    : "",
        cardState === "PURCHASED" ? "nd-product-card--active"    : "",
        cardState === "COMPLETED" ? "nd-product-card--done"      : "",
      ].filter(Boolean).join(" ")}
    >
      {/* ── Image ── */}
      <div className="nd-card-img" onClick={() => openProductLink(item?.product_url)}>
        <img
          src={getPreviewImage(item?.image_url || item?.product_url, item.selection_key)}
          alt={item?.name || "Product"}
          loading="lazy"
        />
        <span className="nd-card-category">{item?.project_category || "General"}</span>
        {isSelected && <div className="nd-card-check">✓</div>}
      </div>

      {/* ── Body ── */}
      <div className="nd-card-body">
        <h3 className="nd-card-title" title={item?.name}>{item?.name || "Product"}</h3>

        <div className="nd-card-meta">
          <span className="nd-card-client" title={item?.project_title}>
            🏢 {item?.project_title || "Project"}
          </span>
          <span className="nd-card-price">
            {formatInr(item?.price ?? item?.product_value ?? item?.product_price)}
          </span>
        </div>

        {/* ── SINGLE status pill ── */}
        {pill && (
          <div className={`nd-pill ${pillCls}`}>{pill}</div>
        )}

        {/* ── SINGLE action button ── */}
        <div className="nd-card-action">
          {canTask && (
            <button type="button" className="nd-btn nd-btn--task" onClick={handleTask}>
              Go to My Tasks →
            </button>
          )}
          {canSelect && (
            <button
              type="button"
              className={`nd-btn ${isSelected ? "nd-btn--selected" : "nd-btn--select"}`}
              onClick={handleSelect}
            >
              {actionLabel()}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

/* ─── Empty state ──────────────────────────────────────────── */
const EmptyState = ({ icon, title, subtitle }) => (
  <div className="nd-empty">
    <div className="nd-empty-icon">{icon}</div>
    <h3>{title}</h3>
    <p>{subtitle}</p>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════════════ */
const ParticipantDashboard = () => {
  const navigate = useNavigate();

  const [loading, setLoading]         = useState(true);
  const [user, setUser]               = useState(null);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [activeProjects, setActiveProjects]       = useState([]);
  const [appliedProjects, setAppliedProjects]     = useState([]);
  const [completedProjects, setCompletedProjects] = useState([]);
  const [dashboardProducts, setDashboardProducts] = useState([]);
  const [selectedProductKeys, setSelectedProductKeys] = useState([]);
  const [sendingRequest, setSendingRequest]       = useState(false);
  const [searchTerm, setSearchTerm]   = useState("");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [activeTab, setActiveTab]     = useState("catalog");
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [toasts, setToasts]           = useState([]);
  const [notifBell, setNotifBell]     = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifRef = useRef(null);

  /* ── toast helpers ── */
  const addToast = useCallback((message, type = "info") => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);
  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  /* ── paths ── */
  const uid  = user?.id;
  const path = (seg) => uid ? `/participant/${uid}/${seg}` : "/dashboard";

  /* ── load dashboard ── */
  const loadDashboard = useCallback(async () => {
    const token = getStoredToken();
    if (!token) { navigate("/login", { replace: true }); return; }
    setLoading(true);
    try {
      const backendUser = await verifyBackendUser(token);
      const role = backendUser?.role?.toUpperCase?.() || "";
      if (role === "ADMIN" || role === "SUPER_ADMIN") { navigate("/dashboard", { replace: true }); return; }
      if (role !== "PARTICIPANT") throw new Error("Unsupported role.");
      setUser(backendUser);

      const [profileRes, meRes, activeRes, appliedRes, completedRes, catalogRes] = await Promise.all([
        fetchJson("/users/me/profile-completion", token),
        fetchJson("/users/me", token),
        fetchJson("/projects/active", token),
        fetchJson("/projects/applied", token),
        fetchJson("/projects/completed", token),
        getActiveCatalog(),
      ]);

      setUser((prev) => ({ ...(prev || {}), ...(backendUser || {}), ...(meRes?.data || {}) }));
      setProfileCompletion(Number(profileRes?.data?.percentage) || 0);
      setActiveProjects(Array.isArray(activeRes?.data) ? activeRes.data : []);

      const nextApplied = Array.isArray(appliedRes?.data) ? appliedRes.data : [];
      setAppliedProjects(nextApplied);

      // Use dedicated /projects/completed endpoint; if it returns nothing,
      // fall back to COMPLETED-status items from the applied list (which
      // includes allocations whose status has been marked COMPLETED).
      const dedicatedCompleted = Array.isArray(completedRes?.data) ? completedRes.data : [];
      if (dedicatedCompleted.length > 0) {
        setCompletedProjects(dedicatedCompleted);
      } else {
        const completedFromApplied = nextApplied.filter(
          (item) =>
            String(item?.status || "").toUpperCase() === "COMPLETED" ||
            String(item?.allocation?.status || "").toUpperCase() === "COMPLETED"
        );
        setCompletedProjects(completedFromApplied);
      }

      const nextCatalog = Array.isArray(catalogRes?.data?.data) ? catalogRes.data.data : [];
      const activeItems = Array.isArray(activeRes?.data) ? activeRes.data : [];
      const activeProjs = activeItems.map((r) => r?.projects).filter(Boolean);
      const catalogIds  = new Set(nextCatalog.map((p) => p.id));
      const allProjects = [...nextCatalog, ...activeProjs.filter((p) => p?.id && !catalogIds.has(p.id))];

      const buckets = await Promise.all(
        allProjects.map(async (project) => {
          try {
            const res = await fetchJson(`/projects/${project.id}/products`, token);
            const rows = Array.isArray(res?.data?.products) ? res.data.products : [];
            return rows.map((product) => ({
              ...product,
              project_id: project.id,
              project_title: project?.title || project?.name || "Project",
              project_category: project?.category || "General",
              selection_key: `${project.id}::${product.id}`,
            }));
          } catch { return []; }
        })
      );

      setDashboardProducts(
        buckets.flat().filter((item) =>
          Boolean(String(item?.name || "").trim() && String(item?.product_url || "").trim() && item?.id && item?.project_id)
        )
      );
      setSelectedProductKeys([]);

      /* ── Notifications ── */
      try {
        const notifRes = await fetchJson("/notifications", token);
        const notifs = Array.isArray(notifRes?.data) ? notifRes.data : [];
        const unread  = notifs.filter((n) => !n.is_read);
        setNotifBell(unread);
        // Show toast for each unread notification (max 3)
        unread.slice(0, 3).forEach((n, i) => {
          const isApproved = String(n.type || "").toUpperCase().includes("APPROVED");
          const isRejected = String(n.type || "").toUpperCase().includes("REJECTED");
          setTimeout(() => {
            if (n.message) addToast(n.message, isApproved ? "success" : isRejected ? "error" : "info");
          }, i * 600);
        });
      } catch { /* non-critical */ }

    } catch (err) {
      if (/token|unauthorized|expired|forbidden/i.test(err.message || "")) {
        clearStoredTokens(); navigate("/login", { replace: true }); return;
      }
      addToast(err.message || "Unable to load dashboard.", "error");
    } finally { setLoading(false); }
  }, [navigate, addToast]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    if (!uid) return;
    const key = `nitro_seen_${uid}`;
    try {
      const seen = window.localStorage.getItem(key) === "1";
      setIsFirstVisit(!seen);
      if (!seen) window.localStorage.setItem(key, "1");
    } catch { setIsFirstVisit(false); }
  }, [uid]);

  /* close notif panel on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifPanel(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    addToast("Logging you out…", "info");
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  const dismissAllNotifications = async () => {
    const ids = notifBell.map((n) => n.id).filter(Boolean);
    const token = getStoredToken();
    setNotifBell([]);
    setShowNotifPanel(false);
    addToast("All notifications cleared.", "info");
    try {
      await Promise.all(ids.map((id) => fetchJson(`/notifications/${id}/read`, token, { method: "PATCH" })));
    } catch { /* ignore */ }
  };

  /* ── derived ── */
  const displayName = useMemo(() => {
    const fn = user?.full_name?.trim?.() || "";
    if (fn) return fn.split(" ")[0] || fn;
    const em = String(user?.email || "").trim();
    if (em.includes("@")) return em.split("@")[0];
    return "Participant";
  }, [user]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return dashboardProducts.filter((item) => {
      const matchSearch = !term
        || String(item?.name || "").toLowerCase().includes(term)
        || String(item?.project_title || "").toLowerCase().includes(term)
        || String(item?.project_category || "").toLowerCase().includes(term);
      const matchClient = clientFilter === "ALL" || String(item?.project_title || "").trim() === clientFilter;
      return matchSearch && matchClient;
    });
  }, [dashboardProducts, searchTerm, clientFilter]);

  const clientFilterOptions = useMemo(() => {
    const unique = new Set(dashboardProducts.map((item) => String(item?.project_title || "").trim()).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [dashboardProducts]);

  const selectedProducts = useMemo(() => {
    const s = new Set(selectedProductKeys);
    return dashboardProducts.filter((item) => s.has(item.selection_key));
  }, [dashboardProducts, selectedProductKeys]);

  /* Applied = PENDING + REJECTED only */
  const appliedRows = useMemo(() =>
    appliedProjects.filter((item) => ["PENDING", "REJECTED"].includes(String(item?.status || "").toUpperCase()))
  , [appliedProjects]);

  /* Cancelled rows — show in dedicated tab only */
  const cancelledRows = useMemo(() =>
    appliedProjects.filter((item) => {
      const appStatus = String(item?.status || "").toUpperCase();
      const allocStatus = String(item?.allocation?.status || "").toUpperCase();
      return appStatus === "CANCELLED" || (allocStatus === "CANCELLED" && appStatus !== "APPROVED");
    })
  , [appliedProjects]);

  /* Approved rows — latest per product, grouped by active allocation (if available) */
  const approvedRows = useMemo(() => {
    const toMs = (v) => {
      const ms = Date.parse(v || "");
      return Number.isFinite(ms) ? ms : 0;
    };

    const latestByProduct = new Map();
    for (const item of appliedProjects) {
      const projectId = item?.project_id || item?.projects?.id || "";
      const productId = item?.product_id || item?.project_products?.id || "";
      if (!projectId || !productId) continue;
      const key = `${projectId}::${productId}`;
      const existing = latestByProduct.get(key);
      const itemMs = Math.max(toMs(item?.reviewed_at), toMs(item?.created_at));
      const existingMs = existing ? Math.max(toMs(existing?.reviewed_at), toMs(existing?.created_at)) : -1;
      if (!existing || itemMs >= existingMs) latestByProduct.set(key, item);
    }

    const approvedLatest = Array.from(latestByProduct.values()).filter(
      (item) => String(item?.status || "").toUpperCase() === "APPROVED"
    );
    if (!approvedLatest.length) return [];

    const groups = new Map();
    for (const item of approvedLatest) {
      const projectId = item?.project_id || item?.projects?.id || "";
      const allocId = item?.allocation?.id || null;
      const allocStatus = String(item?.allocation?.status || "").toUpperCase();
      const isActiveAlloc = allocId && ["RESERVED", "PURCHASED"].includes(allocStatus);
      const groupKey = isActiveAlloc ? `alloc:${allocId}` : `project:${projectId || "na"}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: groupKey,
          allocationId: isActiveAlloc ? allocId : null,
          allocationStatus: isActiveAlloc ? allocStatus : null,
          products: [],
          requestedAt: null,
        });
      }

      const group = groups.get(groupKey);
      const pn = item?.project_products?.name || item?.product_name || "—";
      const brand = item?.projects?.title || item?.brand_name || null;
      const itemDate = item?.reviewed_at || item?.created_at || null;
      const alreadyAdded = group.products.some((p) => p.name === pn && p.brand === brand);
      if (!alreadyAdded) group.products.push({ name: pn, brand });

      if (itemDate && new Date(itemDate) > new Date(group.requestedAt || 0)) {
        group.requestedAt = itemDate;
      }
    }

    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0)
    );
  }, [appliedProjects]);

  const activeTabCount = useMemo(() =>
    activeProjects.filter((item) =>
      Boolean(String((item?.selected_product || item?.project_products)?.name || "").trim())
    ).length
  , [activeProjects]);

  /* ── send request ── */
  const sendRequest = async () => {
    const token = getStoredToken();
    if (!token || !selectedProducts.length) return;
    setSendingRequest(true);
    addToast(`Sending ${selectedProducts.length} request(s) to admin…`, "info");
    try {
      const results = await Promise.allSettled(
        selectedProducts.map((item) =>
          fetchJson(`/projects/${item.project_id}/apply`, token, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: item.id || item.product_id }),
          })
        )
      );
      const success = results.filter((r) => r.status === "fulfilled" && r.value?.success && !r.value?.alreadyPending).length;
      const already = results.filter((r) => r.status === "fulfilled" && r.value?.alreadyPending).length;
      const failed  = results.filter((r) => r.status === "rejected").length;

      if (success > 0) {
        const appliedRes = await fetchJson("/projects/applied", token);
        setAppliedProjects(Array.isArray(appliedRes?.data) ? appliedRes.data : []);
        addToast(`🎉 ${success} request${success > 1 ? "s" : ""} submitted! Admin will review soon.`, "success");
      }
      if (already > 0) addToast(`⏳ ${already} product${already > 1 ? "s" : ""} already waiting for approval.`, "warning");
      if (failed > 0)  addToast(`❌ ${failed} request${failed > 1 ? "s" : ""} could not be submitted. Try again.`, "error");
      setSelectedProductKeys([]);
    } catch (err) {
      addToast(err.message || "Unable to submit request.", "error");
    } finally { setSendingRequest(false); }
  };

  /* ── tab navigation with activity toasts ── */
  const handleTabChange = (key) => {
    setActiveTab(key);
    const messages = {
      catalog:   "Browsing available products.",
      approved:  "Viewing your approved products.",
      cancelled: "Viewing your cancelled products.",
      applied:   "Viewing your pending applications.",
      completed: "Viewing your completed campaigns.",
    };
    if (messages[key]) addToast(messages[key], "info");
  };

  /* ── tabs ── */
  const approvedProductCount = useMemo(
    () => approvedRows.reduce((sum, row) => sum + (row.products?.length || 0), 0),
    [approvedRows]
  );

  const tabs = [
    { key: "catalog",   label: "Browse Products", count: filteredProducts.length },
    { key: "approved",  label: "Approved",         count: approvedProductCount },
    { key: "cancelled", label: "Cancelled",        count: cancelledRows.length },
    { key: "applied",   label: "Applied",          count: appliedRows.length },
    { key: "completed", label: "Completed",        count: completedProjects.length },
  ];

  /* ── loading screen ── */
  if (loading) {
    return (
      <div className="nd-loading-screen">
        <div className="nd-loading-spinner" />
        <p>Loading your dashboard…</p>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────── */
  return (
    <div className="nd-dashboard">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ══ TOPBAR ══ */}
      <header className="nd-topbar">
        <div className="nd-brand">
          <span className="nd-brand-name">Nitro</span>
          <span className="nd-brand-tag">Buy · Review · Earn</span>
        </div>

        <div className="nd-search-wrap">
          <span className="nd-search-icon">⌕</span>
          <input
            type="text"
            className="nd-search"
            placeholder="Search products or brands…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <nav className="nd-nav">
          <button type="button" className="nd-nav-btn nd-nav-btn--active" onClick={() => navigate(path("dashboard"))}>Dashboard</button>
          <button type="button" className="nd-nav-btn" onClick={() => { addToast("Opening Payouts page…", "info"); navigate(path("payouts")); }}>Payouts</button>
          <button type="button" className="nd-nav-btn" onClick={() => { addToast("Opening your Profile…", "info"); navigate(path("profile")); }}>Profile</button>
        </nav>

        <div className="nd-topbar-right">
          {/* ── Bell ── */}
          <div className="nd-notif-wrap" ref={notifRef}>
            <button
              type="button"
              className="nd-notif-btn"
              onClick={() => setShowNotifPanel((v) => !v)}
              aria-label="Notifications"
            >
              🔔
              {notifBell.length > 0 && <span className="nd-notif-dot">{notifBell.length}</span>}
            </button>

            {showNotifPanel && (
              <div className="nd-notif-panel">
                <div className="nd-notif-panel-head">
                  <span>Notifications</span>
                  {notifBell.length > 0 && (
                    <button type="button" className="nd-notif-clear" onClick={dismissAllNotifications}>
                      Mark all read
                    </button>
                  )}
                </div>
                {notifBell.length === 0 ? (
                  <div className="nd-notif-empty">All caught up! 🎉</div>
                ) : (
                  <ul className="nd-notif-list">
                    {notifBell.map((n) => {
                      const isApproved = String(n.type || "").toUpperCase().includes("APPROVED");
                      const isRejected = String(n.type || "").toUpperCase().includes("REJECTED");
                      return (
                        <li key={n.id} className="nd-notif-item">
                          <span
                            className="nd-notif-dot-color"
                            data-type={isApproved ? "approved" : isRejected ? "rejected" : "info"}
                          />
                          <div className="nd-notif-text">
                            {n.title && <strong>{n.title}</strong>}
                            <p>{n.message || n.title}</p>
                            <small>{formatDateTime(n.created_at)}</small>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          <button type="button" className="nd-logout" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* ══ MAIN ══ */}
      <main className="nd-main">

        {/* ── Hero ── */}
        <section className="nd-hero">
          <div className="nd-hero-left">
            <h1 className="nd-hero-title">
              {isFirstVisit ? `Welcome, ${displayName}!` : `Welcome back, ${displayName}!`}
            </h1>
            <p className="nd-hero-sub">
              {activeTabCount > 0
                ? `You have ${activeTabCount} active project${activeTabCount !== 1 ? "s" : ""} in progress.`
                : "Browse products below and select ones you'd like to review."}
            </p>
          </div>

          <div className="nd-hero-stats">
            <div className="nd-stat-card">
              <span className="nd-stat-num">{activeTabCount}</span>
              <span className="nd-stat-label">Active</span>
            </div>
            <div className="nd-stat-card">
              <span className="nd-stat-num">{appliedRows.length}</span>
              <span className="nd-stat-label">Applied</span>
            </div>
            <div className="nd-stat-card">
              <span className="nd-stat-num">{completedProjects.length}</span>
              <span className="nd-stat-label">Done</span>
            </div>
          </div>

          <div className="nd-hero-profile">
            <div className="nd-profile-head">
              <span>Profile Completion</span>
              <strong className={profileCompletion === 100 ? "nd-pct--full" : ""}>{profileCompletion}%</strong>
            </div>
            <div className="nd-progress-bar">
              <div className="nd-progress-fill" style={{ width: `${Math.max(0, Math.min(100, profileCompletion))}%` }} />
            </div>
            {profileCompletion < 100 && (
              <button
                type="button"
                className="nd-profile-cta"
                onClick={() => { addToast("Opening your profile to complete it…", "info"); navigate(path("profile")); }}
              >
                Complete Profile →
              </button>
            )}
          </div>
        </section>

        {/* ── Tab bar ── */}
        <div className="nd-tab-bar">
          <div className="nd-tabs" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`nd-tab ${activeTab === tab.key ? "nd-tab--active" : ""}`}
                onClick={() => handleTabChange(tab.key)}
              >
                {tab.label}
                {tab.count > 0 && <span className="nd-tab-count">{tab.count}</span>}
              </button>
            ))}
          </div>

          {activeTab === "catalog" && (
            <div className="nd-filter-row">
              <label htmlFor="nd-brand-filter" className="nd-filter-label">Brand:</label>
              <select
                id="nd-brand-filter"
                className="nd-filter-select"
                value={clientFilter}
                onChange={(e) => {
                  setClientFilter(e.target.value);
                  addToast(e.target.value === "ALL" ? "Showing all brands." : `Filtered by ${e.target.value}.`, "info");
                }}
              >
                <option value="ALL">All Brands</option>
                {clientFilterOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <span className="nd-filter-count">
                {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* ══ TAB: Browse Products ══ */}
        {activeTab === "catalog" && (
          <div className="nd-tab-content">
            {filteredProducts.length === 0 ? (
              <EmptyState
                icon="📦"
                title="No products available"
                subtitle="New campaigns are added regularly. Check back soon!"
              />
            ) : (
              <div className="nd-product-grid">
                {filteredProducts.map((item) => {
                  const latestApp = getLatestProductApplication(appliedProjects, item.id);
                  return (
                    <ProductCard
                      key={item.selection_key}
                      item={item}
                      isSelected={selectedProductKeys.includes(item.selection_key)}
                      latestApplication={latestApp}
                      addToast={addToast}
                      onSelect={(key) => setSelectedProductKeys((prev) =>
                        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                      )}
                      onNavigate={(allocId) => {
                        if (allocId) navigate(`${path("allocation/active")}?allocation=${allocId}`);
                        else navigate(path("allocation/active"));
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: Approved ══ */}
        {activeTab === "approved" && (
          <div className="nd-tab-content">
            {approvedRows.length === 0 ? (
              <EmptyState
                icon="✅"
                title="No approved requests yet"
                subtitle="Once admin approves your product requests, they appear here with action steps."
              />
            ) : (
              <div className="nd-list-cards">
                {approvedRows.map((row) => (
                  <div key={row.id} className="nd-list-card nd-list-card--approved">
                    <div className="nd-list-card-icon">✓</div>
                    <div className="nd-list-card-body">
                      {/* Numbered product list with brand name per item */}
                      <ul className="nd-approved-product-list">
                        {row.products.map((p, idx) => (
                          <li key={idx} className="nd-approved-product-item">
                            <span className="nd-approved-product-index">{idx + 1}.</span>
                            <span className="nd-approved-product-info">
                              <span className="nd-approved-product-name">{p.name}</span>
                              {p.brand && (
                                <span className="nd-approved-product-brand">{p.brand}</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <span className="nd-list-card-date">Approved {formatDateTime(row.requestedAt)}</span>
                    </div>
                    <StatusBadge status={row.allocationStatus || "APPROVED"} />
                    <div className="nd-list-card-action">
                      <button
                        type="button"
                        className="nd-btn nd-btn--task"
                        onClick={() => {
                          addToast("Opening your task — submit your invoice and review there.", "info");
                          if (row.allocationId) {
                            navigate(`${path("allocation/active")}?allocation=${row.allocationId}`);
                          } else {
                            navigate(path("allocation/active"));
                          }
                        }}
                      >
                        Submit Invoice &amp; Review →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: Cancelled ══ */}
        {activeTab === "cancelled" && (
          <div className="nd-tab-content">
            {cancelledRows.length === 0 ? (
              <EmptyState
                icon="✕"
                title="No cancelled products"
                subtitle="Cancelled allocations will appear here."
              />
            ) : (
              <div className="nd-list-cards">
                {cancelledRows.map((item) => (
                  <div key={item.id} className="nd-list-card nd-list-card--rejected">
                    <div className="nd-list-card-icon">✕</div>
                    <div className="nd-list-card-body">
                      <h4>{item?.project_products?.name || item?.product_name || "—"}</h4>
                      <span className="nd-list-card-project">{item?.projects?.title || "—"}</span>
                      <span className="nd-list-card-date">
                        Cancelled {formatDateTime(item?.allocation?.updated_at || item?.updated_at || item?.reviewed_at || item?.created_at)}
                      </span>
                    </div>
                    <StatusBadge status="CANCELLED" />
                    <div className="nd-list-card-action">
                      <button
                        type="button"
                        className="nd-btn nd-btn--select"
                        onClick={() => {
                          handleTabChange("catalog");
                          addToast("Go to Browse Products to reapply for this product.", "info");
                        }}
                      >
                        Reapply from Browse
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: Applied ══ */}
        {activeTab === "applied" && (
          <div className="nd-tab-content">
            {appliedRows.length === 0 ? (
              <EmptyState
                icon="📋"
                title="No pending applications"
                subtitle="Select products from Browse and send a request — they'll appear here while admin reviews."
              />
            ) : (
              <div className="nd-list-cards">
                {appliedRows.map((item) => {
                  const status = String(item?.status || "").toUpperCase();
                  return (
                    <div
                      key={item.id}
                      className={`nd-list-card nd-list-card--${status === "REJECTED" ? "rejected" : "pending"}`}
                    >
                      <div className="nd-list-card-icon">{status === "REJECTED" ? "✕" : "⏳"}</div>
                      <div className="nd-list-card-body">
                        <h4>{item?.project_products?.name || "—"}</h4>
                        <span className="nd-list-card-project">{item?.projects?.title || "—"}</span>
                        <span className="nd-list-card-date">Applied {formatDateTime(item?.created_at)}</span>
                      </div>
                      <StatusBadge status={status} />
                      <div className="nd-list-card-action">
                        {status === "REJECTED" ? (
                          <button
                            type="button"
                            className="nd-btn nd-btn--select"
                            onClick={() => {
                              handleTabChange("catalog");
                              addToast("Showing Browse tab — find the product to request again.", "info");
                            }}
                          >
                            Request Again
                          </button>
                        ) : (
                          <span className="nd-chip nd-chip--waiting">Awaiting Review</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: Completed ══ */}
        {activeTab === "completed" && (
          <div className="nd-tab-content">
            {completedProjects.length === 0 ? (
              <EmptyState
                icon="🏆"
                title="No completed campaigns yet"
                subtitle="Complete your tasks and reviews — finished campaigns show up here."
              />
            ) : (
              <div className="nd-list-cards">
                {completedProjects.map((item) => (
                  <div key={item.id} className="nd-list-card nd-list-card--completed">
                    <div className="nd-list-card-icon">★</div>
                    <div className="nd-list-card-body">
                      <h4>{item?.project_products?.name || item?.name || "—"}</h4>
                      <span className="nd-list-card-project">{item?.projects?.title || item?.project_title || "—"}</span>
                      <span className="nd-list-card-date">
                        Completed {formatDateTime(item?.completed_at || item?.reviewed_at || item?.updated_at)}
                      </span>
                    </div>
                    <StatusBadge status="COMPLETED" />
                    <div className="nd-list-card-action">
                      {item?.projects?.reward ? (
                        <span className="nd-chip nd-chip--reward">
                          🎁 {formatInr(item.projects.reward)} earned
                        </span>
                      ) : (
                        <span className="nd-chip nd-chip--done">Campaign complete</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── Fixed selection bar ── */}
      {activeTab === "catalog" && selectedProducts.length > 0 && (
        <div className="nd-selection-bar">
          <div className="nd-selection-info">
            <span className="nd-selection-count">{selectedProducts.length}</span>
            <div>
              <strong>{selectedProducts.length} product{selectedProducts.length !== 1 ? "s" : ""} selected</strong>
              <small>Ready to send for admin approval</small>
            </div>
          </div>
          <div className="nd-selection-actions">
            <button
              type="button"
              className="nd-btn nd-btn--ghost"
              onClick={() => { setSelectedProductKeys([]); addToast("Selection cleared.", "info"); }}
            >
              Clear
            </button>
            <button
              type="button"
              className="nd-btn nd-btn--send"
              disabled={sendingRequest}
              onClick={sendRequest}
            >
              {sendingRequest ? "Sending…" : "Send Request to Admin →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile nav ── */}
      <nav className="nd-mobile-nav" aria-label="Mobile navigation">
        <button type="button" className="nd-mobile-btn nd-mobile-btn--active" onClick={() => navigate(path("dashboard"))}>
          <span>🏠</span><span>Home</span>
        </button>
        <button type="button" className="nd-mobile-btn" onClick={() => navigate(path("allocation/active"))}>
          <span>📋</span><span>Tasks</span>
        </button>
        <button type="button" className="nd-mobile-btn" onClick={() => navigate(path("payouts"))}>
          <span>💰</span><span>Payouts</span>
        </button>
        <button type="button" className="nd-mobile-btn" onClick={() => navigate(path("profile"))}>
          <span>👤</span><span>Profile</span>
        </button>
      </nav>
    </div>
  );
};

export default ParticipantDashboard;
