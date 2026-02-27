import { useCallback, useEffect, useMemo, useState } from "react";
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

const fetchJson = async (path, token, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    method: options.method || "GET",
    body: options.body
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
  return `https://picsum.photos/seed/${encodeURIComponent(fallbackSeed)}/640/420`;
};

// Returns the most recent application row for a product, or null if never applied
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
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const formatInr = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
};

const openProductLink = (url) => {
  const raw = String(url || "").trim();
  if (!raw) return;
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  window.open(normalized, "_blank", "noopener,noreferrer");
};

const ParticipantDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [activeProjects, setActiveProjects] = useState([]);
  const [appliedProjects, setAppliedProjects] = useState([]);
  const [catalogProjects, setCatalogProjects] = useState([]);
  const [dashboardProducts, setDashboardProducts] = useState([]);
  const [selectedProductKeys, setSelectedProductKeys] = useState([]);
  const [sendingProductRequest, setSendingProductRequest] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [topNav, setTopNav] = useState("dashboard");
  const [allocationView, setAllocationView] = useState("allocation");
  const [catalogNotice, setCatalogNotice] = useState("");
  const [isFirstDashboardVisit, setIsFirstDashboardVisit] = useState(false);
  const [verifiedUnlockedProductMap, setVerifiedUnlockedProductMap] = useState({});
  const [approvedNotifications, setApprovedNotifications] = useState([]);

  const displayName = useMemo(() => {
    const fullName = user?.full_name?.trim?.() || "";
    if (fullName) return fullName.split(" ")[0] || fullName;
    const email = String(user?.email || "").trim();
    if (email.includes("@")) return email.split("@")[0];
    return "Participant";
  }, [user]);

  const participantDashboardPath = user?.id ? `/participant/${user.id}/dashboard` : "/dashboard";

  const loadDashboard = useCallback(async () => {
    const token = getStoredToken();
    if (!token) { navigate("/login", { replace: true }); return; }
    setLoading(true);
    setError("");
    try {
      const backendUser = await verifyBackendUser(token);
      const role = backendUser?.role?.toUpperCase?.() || "";
      if (role === "ADMIN" || role === "SUPER_ADMIN") { navigate("/dashboard", { replace: true }); return; }
      if (role !== "PARTICIPANT") throw new Error("Unsupported role for participant dashboard.");
      setUser(backendUser);

      const [profileRes, myProfileRes, activeRes, appliedRes, catalogRes] = await Promise.all([
        fetchJson("/users/me/profile-completion", token),
        fetchJson("/users/me", token),
        fetchJson("/projects/active", token),
        fetchJson("/projects/applied", token),
        getActiveCatalog()
      ]);

      const profileUser = myProfileRes?.data || {};
      setUser((prev) => ({ ...(prev || {}), ...(backendUser || {}), ...(profileUser || {}) }));

      const nextApplied = Array.isArray(appliedRes?.data) ? appliedRes.data : [];
      const consumedProductIdsByProject = new Map();
      const pushConsumedProduct = (projectId, productId) => {
        if (!projectId || !productId) return;
        if (!consumedProductIdsByProject.has(projectId)) consumedProductIdsByProject.set(projectId, new Set());
        consumedProductIdsByProject.get(projectId).add(productId);
      };
      for (const row of nextApplied) {
        const status = String(row?.status || "").toUpperCase();
        const projectId = row?.project_id || row?.projects?.id;
        const productId = row?.product_id || row?.project_products?.id;
        if (["PURCHASED", "COMPLETED"].includes(status)) pushConsumedProduct(projectId, productId);
      }

      const nextCatalog = Array.isArray(catalogRes?.data?.data) ? catalogRes.data.data : [];
      const activeProjectItems = Array.isArray(activeRes?.data) ? activeRes.data : [];
      const activeProjectsFromActive = activeProjectItems.map((row) => row?.projects).filter(Boolean);
      const catalogIds = new Set(nextCatalog.map((p) => p.id));
      const extraProjects = activeProjectsFromActive.filter((p) => p?.id && !catalogIds.has(p.id));
      const allProjects = [...nextCatalog, ...extraProjects];

      const productBuckets = await Promise.all(
        allProjects.map(async (project) => {
          try {
            const productsRes = await fetchJson(`/projects/${project.id}/products`, token);
            const rows = Array.isArray(productsRes?.data?.products) ? productsRes.data.products : [];
            return rows.map((product) => ({
              ...product,
              project_id: project.id,
              project_title: project?.title || project?.name || "Project",
              project_category: project?.category || "General",
              created_by_name: project?.created_by_name || "Client",
              selection_key: `${project.id}::${product.id}`,
            }));
          } catch { return []; }
        })
      );

      const nextProducts = productBuckets.flat().filter((item) => {
        const name = String(item?.name || "").trim();
        const url = String(item?.product_url || "").trim();
        return Boolean(name && url && item?.id && item?.project_id);
      });

      setVerifiedUnlockedProductMap({});
      setDashboardProducts(nextProducts);
      setSelectedProductKeys([]);
      setProfileCompletion(Number(profileRes?.data?.percentage) || 0);
      setActiveProjects(Array.isArray(activeRes?.data) ? activeRes.data : []);
      setAppliedProjects(nextApplied);
      setCatalogProjects(nextCatalog);

      try {
        const notifRes = await fetchJson("/notifications", token);
        const notifs = Array.isArray(notifRes?.data) ? notifRes.data : [];
        setApprovedNotifications(
          notifs.filter(
            (n) =>
              ["PRODUCT_APPLICATION_APPROVED", "PRODUCT_APPLICATION_REJECTED"].includes(String(n.type || "").toUpperCase())
              && !n.is_read
          )
        );
      } catch { /* non-critical */ }

    } catch (err) {
      if (/token|unauthorized|expired|forbidden/i.test(err.message || "")) {
        clearStoredTokens(); navigate("/login", { replace: true }); return;
      }
      setError(err.message || "Unable to load participant dashboard.");
    } finally { setLoading(false); }
  }, [navigate]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  const participantPayoutPath = user?.id ? `/participant/${user.id}/payouts` : "/dashboard";
  const participantAllocationPath = user?.id ? `/participant/${user.id}/allocation/active` : "/dashboard";
  const participantProfilePath = user?.id ? `/participant/${user.id}/profile` : "/dashboard";

  const filteredDashboardProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return dashboardProducts.filter((item) => {
      const clientName = String(item?.project_title || "").trim();
      const title = String(item?.project_title || "").toLowerCase();
      const productName = String(item?.name || "").toLowerCase();
      const category = String(item?.category || "").toLowerCase();
      const matchesSearch = !term || title.includes(term) || productName.includes(term) || category.includes(term);
      const matchesClient = clientFilter === "ALL" || clientName === clientFilter;
      return matchesSearch && matchesClient;
    });
  }, [dashboardProducts, searchTerm, clientFilter]);

  const clientFilterOptions = useMemo(() => {
    const unique = new Set(
      dashboardProducts
        .map((item) => String(item?.project_title || "").trim())
        .filter(Boolean)
    );
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [dashboardProducts]);

  const unlockedProjects = useMemo(
    () => catalogProjects.filter((item) => String(item?.access_status || "").toUpperCase() === "APPROVED"),
    [catalogProjects]
  );

  const approvedWithoutAllocation = useMemo(
    () => appliedProjects.filter((item) => {
      const status = String(item?.status || "").toUpperCase();
      return status === "APPROVED" && !item?.allocation?.id;
    }),
    [appliedProjects]
  );

  const activeTabCount = useMemo(() => {
    const allocatedProjectIds = new Set(activeProjects.map((row) => row?.projects?.id).filter(Boolean));
    const approvedNoAllocationProjectIds = new Set(approvedWithoutAllocation.map((item) => item?.project_id).filter(Boolean));
    const allocatedCount = activeProjects.filter((item) => Boolean(String((item?.selected_product || item?.project_products)?.name || "").trim())).length;
    const approvedWithoutAllocationCount = approvedWithoutAllocation
      .filter((item) => !allocatedProjectIds.has(item?.project_id))
      .filter((item) => Boolean(String((item?.selected_product || item?.project_products)?.name || "").trim())).length;
    const unlockedOnlyCount = unlockedProjects
      .filter((project) => verifiedUnlockedProductMap?.[project.id] === true)
      .filter((project) => !allocatedProjectIds.has(project.id) && !approvedNoAllocationProjectIds.has(project.id)).length;
    return allocatedCount + unlockedOnlyCount + approvedWithoutAllocationCount;
  }, [activeProjects, unlockedProjects, approvedWithoutAllocation, verifiedUnlockedProductMap]);

  const selectedProducts = useMemo(() => {
    const selectedSet = new Set(selectedProductKeys);
    return dashboardProducts.filter((item) => selectedSet.has(item.selection_key));
  }, [dashboardProducts, selectedProductKeys]);

  const selectableSelectedProducts = selectedProducts;
  const approvedRows = useMemo(
    () =>
      appliedProjects
        .filter((item) => String(item?.status || "").toUpperCase() === "APPROVED")
        .map((item) => ({
          id: item.id,
          projectTitle: item?.projects?.title || item?.project_id || "-",
          productName: item?.project_products?.name || item?.product_id || "-",
          requestedAt: item?.reviewed_at || item?.created_at || null,
          allocationId: item?.allocation?.id || null,
          allocationStatus: item?.allocation?.status || null
        }))
        .sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0)),
    [appliedProjects]
  );

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    const key = `nitro_dashboard_seen_${userId}`;
    try {
      const seen = window.localStorage.getItem(key) === "1";
      setIsFirstDashboardVisit(!seen);
      if (!seen) window.localStorage.setItem(key, "1");
    } catch { setIsFirstDashboardVisit(false); }
  }, [user?.id]);

  const dismissAllDecisionNotifications = async () => {
    const ids = approvedNotifications.map((item) => item.id).filter(Boolean);
    if (!ids.length) return;

    const token = getStoredToken();
    setApprovedNotifications([]);
    try {
      await Promise.all(
        ids.map((id) => fetchJson(`/notifications/${id}/read`, token, { method: "PATCH" }))
      );
    } catch { /* ignore */ }
  };

  const decisionNotificationSummary = useMemo(() => {
    if (!approvedNotifications.length) return null;

    const uniqueMessages = [];
    const seen = new Set();
    for (const item of approvedNotifications) {
      const message = String(item?.message || "").trim();
      if (!message) continue;
      if (!seen.has(message)) {
        seen.add(message);
        uniqueMessages.push(message);
      }
    }

    return {
      count: approvedNotifications.length,
      lines: uniqueMessages
    };
  }, [approvedNotifications]);

  const toggleProductSelection = (selectionKey) => {
    setSelectedProductKeys((prev) =>
      prev.includes(selectionKey) ? prev.filter((key) => key !== selectionKey) : [...prev, selectionKey]
    );
  };

  const sendSelectedProductsToAdmin = async () => {
    const token = getStoredToken();
    if (!token || !selectableSelectedProducts.length) return;
    setSendingProductRequest(true);
    setError("");
    setCatalogNotice("");
    try {
      const results = await Promise.allSettled(
        selectableSelectedProducts.map((item) =>
          fetchJson(`/projects/${item.project_id}/apply`, token, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: item.id || item.product_id })
          })
        )
      );

      const successCount = results.filter((r) => r.status === "fulfilled" && r.value?.success && !r.value?.alreadyPending).length;
      const alreadyPendingCount = results.filter((r) => r.status === "fulfilled" && r.value?.alreadyPending === true).length;
      const failedCount = results.filter((r) => r.status === "rejected").length;

      if (successCount > 0) {
        const appliedRes = await fetchJson("/projects/applied", token);
        setAppliedProjects(Array.isArray(appliedRes?.data) ? appliedRes.data : []);
      }

      setSelectedProductKeys([]);

      if (successCount === 0 && alreadyPendingCount > 0 && failedCount === 0) {
        setCatalogNotice("⏳ You have already applied for these products. Please wait for admin approval.");
      } else if (successCount === 0 && failedCount > 0 && alreadyPendingCount === 0) {
        setError("Unable to submit selected products right now. Please try again.");
      } else {
        const parts = [];
        if (successCount > 0) parts.push(`🎉 ${successCount} request(s) submitted successfully!`);
        if (alreadyPendingCount > 0) parts.push(`⏳ ${alreadyPendingCount} already pending admin approval.`);
        if (failedCount > 0) parts.push(`❌ ${failedCount} could not be submitted.`);
        setCatalogNotice(parts.join(" "));
      }
    } catch (err) {
      setError(err.message || "Unable to submit selected products.");
    } finally { setSendingProductRequest(false); }
  };

  if (loading) return <div className="participant-loading">Loading dashboard...</div>;

  return (
    <div className="participant-dashboard">
      <header className="participant-topbar">
        <div className="participant-brand-wrap">
          <div className="participant-brand">Nitro</div>
          <small>Buy. Review. Earn Rewards.</small>
        </div>
        <div className="participant-search-wrap">
          <input type="text" className="participant-search" placeholder="Search projects..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
        </div>
        <nav className="participant-nav-links">
          <button type="button" className={topNav === "dashboard" ? "is-active" : ""} onClick={() => { setTopNav("dashboard"); navigate(participantDashboardPath); }}>Dashboard</button>
          <button type="button" className={topNav === "payouts" ? "is-active" : ""} onClick={() => { setTopNav("payouts"); navigate(participantPayoutPath); }}>Payouts</button>
          <button type="button" className={topNav === "profile" ? "is-active" : ""} onClick={() => { setTopNav("profile"); navigate(participantProfilePath); }}>Profile</button>
        </nav>
        <button type="button" className="participant-logout" onClick={handleLogout}>Logout</button>
      </header>

      <main className="participant-main">
        <section className="participant-hero">
          <div>
            <h1>{isFirstDashboardVisit ? `Welcome, ${displayName}!` : `Welcome back, ${displayName}!`}</h1>
            <p>You have {activeTabCount} active projects in progress.</p>
          </div>
          <div className="participant-completion">
            <div className="participant-completion-head">
              <span>Profile Completion</span>
              <strong>{profileCompletion}%</strong>
            </div>
            <div className="participant-progress-track">
              <div className="participant-progress-fill" style={{ width: `${Math.max(0, Math.min(100, profileCompletion))}%` }} />
            </div>
            <small>Complete your profile to unlock more campaigns.</small>
          </div>
        </section>

        {error ? (
          <div className="participant-alert" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} style={{ background: "transparent", border: "none", color: "inherit", fontSize: "1.2rem", cursor: "pointer", marginLeft: 12 }}>✕</button>
          </div>
        ) : null}

        {decisionNotificationSummary ? (
          <div style={{ marginTop: "1rem", background: "rgba(16,107,66,0.28)", border: "1px solid rgba(56,214,139,0.5)", color: "#c8ffe7", padding: "0.85rem 1rem", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div>
              <strong style={{ display: "block", marginBottom: "0.25rem", color: "#38e2a0" }}>
                Product request updates ({decisionNotificationSummary.count})
              </strong>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.93rem" }}>
                {decisionNotificationSummary.lines.map((line) => (
                  <li key={line} style={{ marginBottom: "0.3rem" }}>{line}</li>
                ))}
              </ul>
            </div>
            <button type="button" onClick={dismissAllDecisionNotifications} style={{ background: "transparent", border: "none", color: "#38e2a0", fontWeight: 700, fontSize: "1.1rem", cursor: "pointer", flexShrink: 0 }}>✕</button>
          </div>
        ) : null}

        <section className="participant-available">
          <div className="participant-allocation-switch" role="tablist" aria-label="Allocation and approvals">
            <button
              type="button"
              role="tab"
              aria-selected={allocationView === "allocation"}
              className={allocationView === "allocation" ? "is-active" : ""}
              onClick={() => setAllocationView("allocation")}
            >
              Product Allocation
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={allocationView === "approved"}
              className={allocationView === "approved" ? "is-active" : ""}
              onClick={() => setAllocationView("approved")}
            >
              Approved Requests
            </button>
          </div>

          {allocationView === "approved" ? (
            <div className="participant-applied-table-wrap">
              <table className="participant-applied-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Product</th>
                    <th>Approved At</th>
                    <th>Allocation</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedRows.length ? (
                    approvedRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.projectTitle}</td>
                        <td>{row.productName}</td>
                        <td>{formatDateTime(row.requestedAt)}</td>
                        <td>{row.allocationId ? (row.allocationStatus || "RESERVED") : "Pending"}</td>
                        <td>
                          {row.allocationId ? (
                            <button
                              type="button"
                              className="participant-applied-action"
                              onClick={() => navigate(`${participantAllocationPath}?allocation=${row.allocationId}`)}
                            >
                              Submit Invoice & Review
                            </button>
                          ) : (
                            <button type="button" className="participant-applied-action" disabled>
                              Allocation Pending
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="participant-muted">No approved products yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              {catalogNotice ? (
                <div className="participant-notice-success" style={{ marginTop: 10 }}>{catalogNotice}</div>
              ) : null}
              <div className="participant-catalog-layout">
                <aside className="participant-filter-sidebar">
                  <h3>Filters</h3>
                  <label htmlFor="participant-client-filter">Client / Brand</label>
                  <select
                    id="participant-client-filter"
                    value={clientFilter}
                    onChange={(event) => setClientFilter(event.target.value)}
                  >
                    <option value="ALL">All Clients</option>
                    {clientFilterOptions.map((clientName) => (
                      <option key={clientName} value={clientName}>
                        {clientName}
                      </option>
                    ))}
                  </select>
                  <small>{filteredDashboardProducts.length} product(s)</small>
                </aside>

                <div className="participant-product-grid">
                  {filteredDashboardProducts.length ? (
                    filteredDashboardProducts.map((item) => {
                      const isSelected = selectedProductKeys.includes(item.selection_key);
                      const latestApplication = getLatestProductApplication(appliedProjects, item.id);
                      const appStatus = String(latestApplication?.status || "").toUpperCase();
                      const allocationStatus = String(latestApplication?.allocation?.status || "").toUpperCase();
                      const canReapply = (
                        !appStatus
                        || appStatus === "PURCHASED"
                        || appStatus === "COMPLETED"
                        || appStatus === "REJECTED"
                        || (appStatus === "APPROVED" && allocationStatus === "COMPLETED")
                      );

                      return (
                        <article
                          key={item.selection_key}
                          className={`participant-product-card participant-product-card-clickable ${isSelected ? "is-selected" : ""}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => openProductLink(item?.product_url)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openProductLink(item?.product_url);
                            }
                          }}
                        >
                          <div className="participant-product-image">
                            <img
                              src={getPreviewImage(item?.image_url || item?.product_url, `${item.selection_key}-allocation`)}
                              alt={item?.name || "Product"}
                              loading="lazy"
                            />
                          </div>
                          <div className="participant-product-body">
                            <span className="participant-product-tag">{item?.project_category || "General"}</span>
                            <h3>{item?.name || "Product"}</h3>
                            <p>Client: {item?.project_title || "Project"}</p>
                            <p>Price: {formatInr(item?.price ?? item?.product_value ?? item?.product_price)}</p>

                            {appStatus === "PENDING" && (
                              <div style={{ marginTop: 8, padding: "6px 12px", borderRadius: 8, background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.4)", color: "#fbbf24", fontSize: "0.82rem", fontWeight: 600, textAlign: "center" }}>
                                Request Pending - Awaiting Admin Approval
                              </div>
                            )}

                            {appStatus === "REJECTED" && (
                              <div style={{ marginTop: 8, padding: "6px 12px", borderRadius: 8, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171", fontSize: "0.82rem", fontWeight: 600, textAlign: "center" }}>
                                Admin Rejected Your Request - You can send request again
                              </div>
                            )}

                            {canReapply && (
                              <button
                                type="button"
                                className="participant-proof-btn participant-mini-action"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleProductSelection(item.selection_key);
                                }}
                              >
                                {isSelected ? "Selected" : appStatus ? "Request Again" : "Select Product"}
                              </button>
                            )}

                            {appStatus === "APPROVED" && allocationStatus !== "COMPLETED" && (
                              <button
                                type="button"
                                className="participant-proof-btn participant-mini-action"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!latestApplication?.allocation?.id) return;
                                  navigate(`${participantAllocationPath}?allocation=${latestApplication.allocation.id}`);
                                }}
                              >
                                Selected Product
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="participant-empty-card">No products available for this search right now.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      {allocationView === "allocation" && dashboardProducts.length ? (
        <div className="participant-bottom-bar">
          <div>
            <strong>{selectableSelectedProducts.length} product(s) selected</strong>
            <small>Review your selection and send it to admin for approval.</small>
          </div>
          <button type="button" className="participant-bottom-bar-btn" disabled={!selectableSelectedProducts.length || sendingProductRequest} onClick={sendSelectedProductsToAdmin}>
            {sendingProductRequest ? "Sending..." : "Send Request to Admin"}
          </button>
        </div>
      ) : null}

      <nav className="participant-mobile-nav" aria-label="Participant mobile navigation">
        <button type="button" className="active" onClick={() => navigate(participantDashboardPath)}>Home</button>
        <button type="button" onClick={() => navigate(participantAllocationPath)}>Tasks</button>
        <button type="button" onClick={() => navigate(participantPayoutPath)}>Payouts</button>
      </nav>
    </div>
  );
};

export default ParticipantDashboard;
