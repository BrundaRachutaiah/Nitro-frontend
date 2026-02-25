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
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    },
    method: options.method || "GET",
    body: options.body
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data;
};

const getPreviewImage = (primaryUrl, fallbackSeed = "nitro-product") => {
  const trimmed = String(primaryUrl || "").trim();
  if (trimmed) {
    if (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(trimmed)) {
      return trimmed;
    }

    try {
      const hostname = new URL(trimmed).hostname;
      if (hostname) {
        return `https://logo.clearbit.com/${hostname}`;
      }
    } catch {
      // Ignore malformed URLs and use deterministic fallback below.
    }
  }

  return `https://picsum.photos/seed/${encodeURIComponent(fallbackSeed)}/640/420`;
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
  const [topNav, setTopNav] = useState("dashboard");
  const [catalogNotice, setCatalogNotice] = useState("");
  const [isFirstDashboardVisit, setIsFirstDashboardVisit] = useState(false);
  const [verifiedUnlockedProductMap, setVerifiedUnlockedProductMap] = useState({});

  const displayName = useMemo(() => {
    const fullName = user?.full_name?.trim?.() || "";
    if (fullName) return fullName.split(" ")[0] || fullName;

    const email = String(user?.email || "").trim();
    if (email.includes("@")) {
      return email.split("@")[0];
    }

    return "Participant";
  }, [user]);

  const participantDashboardPath = user?.id ? `/participant/${user.id}/dashboard` : "/dashboard";

  const loadDashboard = useCallback(async () => {
    const token = getStoredToken();

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    setLoading(true);
    setError("");

    try {
      const backendUser = await verifyBackendUser(token);
      const role = backendUser?.role?.toUpperCase?.() || "";

      if (role === "ADMIN" || role === "SUPER_ADMIN") {
        navigate("/dashboard", { replace: true });
        return;
      }

      if (role !== "PARTICIPANT") {
        throw new Error("Unsupported role for participant dashboard.");
      }

      setUser(backendUser);

      const [profileRes, myProfileRes, activeRes, appliedRes, catalogRes] = await Promise.all([
        fetchJson("/users/me/profile-completion", token),
        fetchJson("/users/me", token),
        fetchJson("/projects/active", token),
        fetchJson("/projects/applied", token),
        getActiveCatalog()
      ]);

      const profileUser = myProfileRes?.data || {};
      setUser((prev) => ({
        ...(prev || {}),
        ...(backendUser || {}),
        ...(profileUser || {})
      }));
      const nextApplied = Array.isArray(appliedRes?.data) ? appliedRes.data : [];
      const consumedProductIdsByProject = new Map();
      const alreadyRequestedProductKeys = new Set();

      const pushConsumedProduct = (projectId, productId) => {
        if (!projectId || !productId) return;
        if (!consumedProductIdsByProject.has(projectId)) {
          consumedProductIdsByProject.set(projectId, new Set());
        }
        consumedProductIdsByProject.get(projectId).add(productId);
      };

      for (const row of nextApplied) {
        const status = String(row?.status || "").toUpperCase();
        if (!["PURCHASED", "COMPLETED"].includes(status)) continue;
        const projectId = row?.project_id || row?.projects?.id;
        const productId = row?.product_id || row?.project_products?.id;
        pushConsumedProduct(projectId, productId);

        const reqProjectId = row?.project_id || row?.projects?.id;
        const reqProductId = row?.product_id || row?.project_products?.id;
        if (reqProjectId && reqProductId) {
          alreadyRequestedProductKeys.add(`${reqProjectId}::${reqProductId}`);
        }
      }

      const nextCatalog = Array.isArray(catalogRes?.data?.data) ? catalogRes.data.data : [];
      const unlockedProjectIds = nextCatalog
        .filter((item) => String(item?.access_status || "").toUpperCase() === "APPROVED")
        .map((item) => item?.id)
        .filter(Boolean);

      const verifiedEntries = await Promise.all(
        unlockedProjectIds.map(async (projectId) => {
          try {
            const productsRes = await fetchJson(`/projects/${projectId}/products`, token);
            const products = Array.isArray(productsRes?.data?.products) ? productsRes.data.products : [];
            const validProductIds = products.filter((item) => {
              const name = String(item?.name || "").trim();
              const url = String(item?.product_url || "").trim();
              const value = Number(item?.product_value || item?.price || 0);
              return Boolean(name && url && value > 0 && item?.id);
            }).map((item) => item.id);

            if (!validProductIds.length) {
              return [projectId, false];
            }

            const consumed = consumedProductIdsByProject.get(projectId) || new Set();
            const hasRemainingProducts = validProductIds.some((productId) => !consumed.has(productId));
            return [projectId, hasRemainingProducts];
          } catch {
            return [projectId, false];
          }
        })
      );
      setVerifiedUnlockedProductMap(Object.fromEntries(verifiedEntries));

      const approvedCatalog = nextCatalog;
      const productBuckets = await Promise.all(
        approvedCatalog.map(async (project) => {
          try {
            const productsRes = await fetchJson(`/projects/${project.id}/products`, token);
            const rows = Array.isArray(productsRes?.data?.products) ? productsRes.data.products : [];
            return rows.map((product) => ({
              ...product,
              project_id: project.id,
              project_title: project?.title || project?.name || "Project",
              project_category: project?.category || "General",
              created_by_name: project?.created_by_name || "Client",
              selection_key: `${project.id}::${product.id}`
            }));
          } catch {
            return [];
          }
        })
      );

      const nextProducts = productBuckets
        .flat()
        .filter((item) => {
          const name = String(item?.name || "").trim();
          const url = String(item?.product_url || "").trim();
          const value = Number(item?.product_value || item?.price || 0);
          return Boolean(name && url && value > 0 && item?.id && item?.project_id);
        });
      setDashboardProducts(nextProducts);
      const preselected = Array.from(alreadyRequestedProductKeys);
      setSelectedProductKeys(preselected);

      setProfileCompletion(Number(profileRes?.data?.percentage) || 0);
      setActiveProjects(Array.isArray(activeRes?.data) ? activeRes.data : []);
      setAppliedProjects(nextApplied);
      setCatalogProjects(nextCatalog);
    } catch (err) {
      if (/token|unauthorized|expired|forbidden|approved/i.test(err.message || "")) {
        clearStoredTokens();
        navigate("/login", { replace: true });
        return;
      }
      setError(err.message || "Unable to load participant dashboard.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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
    if (!searchTerm.trim()) return dashboardProducts;
    const term = searchTerm.toLowerCase();
    return dashboardProducts.filter((item) => {
      const title = String(item?.project_title || "").toLowerCase();
      const productName = String(item?.name || "").toLowerCase();
      const category = String(item?.category || "").toLowerCase();
      return title.includes(term) || productName.includes(term) || category.includes(term);
    });
  }, [dashboardProducts, searchTerm]);

  const unlockedProjects = useMemo(
    () => catalogProjects.filter((item) => String(item?.access_status || "").toUpperCase() === "APPROVED"),
    [catalogProjects]
  );
  const approvedWithoutAllocation = useMemo(
    () =>
      appliedProjects.filter((item) => {
        const status = String(item?.status || "").toUpperCase();
        return status === "APPROVED" && !item?.allocation?.id;
      }),
    [appliedProjects]
  );

  const activeTabCount = useMemo(() => {
    const allocatedProjectIds = new Set(
      activeProjects.map((row) => row?.projects?.id).filter(Boolean)
    );
    const approvedNoAllocationProjectIds = new Set(
      approvedWithoutAllocation.map((item) => item?.project_id).filter(Boolean)
    );

    const allocatedCount = activeProjects.filter((item) => {
      const selectedProduct = item?.selected_product || item?.project_products || null;
      const productName = String(selectedProduct?.name || "").trim();
      return Boolean(productName);
    }).length;

    const approvedWithoutAllocationCount = approvedWithoutAllocation
      .filter((item) => !allocatedProjectIds.has(item?.project_id))
      .filter((item) => {
        const selectedProduct = item?.selected_product || item?.project_products || null;
        const productName = String(selectedProduct?.name || "").trim();
        return Boolean(productName);
      }).length;

    const unlockedOnlyCount = unlockedProjects
      .filter((project) => verifiedUnlockedProductMap?.[project.id] === true)
      .filter((project) => !allocatedProjectIds.has(project.id) && !approvedNoAllocationProjectIds.has(project.id))
      .length;

    return allocatedCount + unlockedOnlyCount + approvedWithoutAllocationCount;
  }, [activeProjects, unlockedProjects, approvedWithoutAllocation, verifiedUnlockedProductMap]);

  const selectedProducts = useMemo(() => {
    const selectedSet = new Set(selectedProductKeys);
    return dashboardProducts.filter((item) => selectedSet.has(item.selection_key));
  }, [dashboardProducts, selectedProductKeys]);
  const selectableSelectedProducts = selectedProducts;

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    const key = `nitro_dashboard_seen_${userId}`;
    try {
      const seen = window.localStorage.getItem(key) === "1";
      setIsFirstDashboardVisit(!seen);
      if (!seen) {
        window.localStorage.setItem(key, "1");
      }
    } catch {
      setIsFirstDashboardVisit(false);
    }
  }, [user?.id]);

  const toggleProductSelection = (selectionKey) => {
    setSelectedProductKeys((prev) =>
      prev.includes(selectionKey)
        ? prev.filter((key) => key !== selectionKey)
        : [...prev, selectionKey]
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
            body: JSON.stringify({ productId: item.id })
          })
        )
      );

      const successCount = results.filter((item) => item.status === "fulfilled").length;
      const failedCount = results.length - successCount;

      if (successCount > 0) {
        const succeededKeys = results
          .map((result, index) => ({ result, key: selectableSelectedProducts[index]?.selection_key }))
          .filter((item) => item.result.status === "fulfilled")
          .map((item) => item.key);

        setSelectedProductKeys((prev) => [...new Set([...prev, ...succeededKeys])]);

        const appliedRes = await fetchJson("/projects/applied", token);
        setAppliedProjects(Array.isArray(appliedRes?.data) ? appliedRes.data : []);
      }

      if (failedCount > 0 && successCount === 0) {
        throw new Error("Unable to submit selected products right now.");
      }

      setCatalogNotice(
        failedCount > 0
          ? `${successCount} request(s) sent. ${failedCount} request(s) could not be submitted.`
          : `${successCount} product request(s) sent to admin successfully.`
      );
    } catch (err) {
      setError(err.message || "Unable to submit selected products.");
    } finally {
      setSendingProductRequest(false);
    }
  };

  if (loading) {
    return <div className="participant-loading">Loading dashboard...</div>;
  }

  return (
    <div className="participant-dashboard">
      <header className="participant-topbar">
        <div className="participant-brand-wrap">
          <div className="participant-brand">Nitro</div>
          <small>Buy. Review. Earn Rewards.</small>
        </div>
        <div className="participant-search-wrap">
          <input
            type="text"
            className="participant-search"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <nav className="participant-nav-links">
          <button
            type="button"
            className={topNav === "dashboard" ? "is-active" : ""}
            onClick={() => {
              setTopNav("dashboard");
              navigate(participantDashboardPath);
            }}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={topNav === "payouts" ? "is-active" : ""}
            onClick={() => {
              setTopNav("payouts");
              navigate(participantPayoutPath);
            }}
          >
            Payouts
          </button>
          <button
            type="button"
            className={topNav === "profile" ? "is-active" : ""}
            onClick={() => {
              setTopNav("profile");
              navigate(participantProfilePath);
            }}
          >
            Profile
          </button>
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

        {error ? <div className="participant-alert">{error}</div> : null}
        <section className="participant-available" />

        <section className="participant-available">
          <div className="participant-section-head">
            <h2>Product Allocation</h2>
          </div>
          {catalogNotice ? <div className="participant-notice-success" style={{ marginTop: 10 }}>{catalogNotice}</div> : null}
          <div className="participant-product-grid">
            {filteredDashboardProducts.length ? (
              filteredDashboardProducts.map((item) => {
                const isSelected = selectedProductKeys.includes(item.selection_key);
                return (
                  <article
                    key={item.selection_key}
                    className={`participant-product-card ${isSelected ? "is-selected" : ""}`}
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
                      <p>{item?.created_by_name || "Client"}</p>
                      <p>Client: {item?.project_title || "Project"}</p>
                      <button
                        type="button"
                        className="participant-proof-btn participant-mini-action"
                        onClick={() => toggleProductSelection(item.selection_key)}
                      >
                        {isSelected ? "Selected" : "Select Product"}
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="participant-empty-card">No products available for this search right now.</div>
            )}
          </div>
        </section>


        
      </main>

      {dashboardProducts.length ? (
        <div className="participant-bottom-bar">
          <div>
            <strong>{selectableSelectedProducts.length} new product(s) selected</strong>
            <small>Review your selection and send it to admin for approval.</small>
          </div>
          <button
            type="button"
            className="participant-bottom-bar-btn"
            disabled={!selectableSelectedProducts.length || sendingProductRequest}
            onClick={sendSelectedProductsToAdmin}
          >
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
