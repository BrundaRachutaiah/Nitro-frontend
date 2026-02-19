import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  API_BASE_URL,
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser
} from "../../lib/auth";
import { getActiveCatalog, requestProjectAccess } from "../../api/project.api";
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

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const daysLeftLabel = (reservedUntil) => {
  const date = new Date(reservedUntil);
  if (Number.isNaN(date.getTime())) return "Timeline unavailable";

  const diff = date.getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return "Expired";
  if (days === 0) return "Due today";
  if (days === 1) return "Due in 1 day";
  return `Due in ${days} days`;
};

const ParticipantDashboard = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [profileCompletion, setProfileCompletion] = useState(0);

  const [activeProjects, setActiveProjects] = useState([]);
  const [appliedProjects, setAppliedProjects] = useState([]);
  const [completedProjects, setCompletedProjects] = useState([]);
  const [catalogProjects, setCatalogProjects] = useState([]);

  const [activeTab, setActiveTab] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [topNav, setTopNav] = useState("dashboard");
  const [requestingProjectId, setRequestingProjectId] = useState("");
  const [catalogNotice, setCatalogNotice] = useState("");

  const displayName = useMemo(() => {
    const fullName = user?.full_name?.trim?.() || "";
    if (!fullName) return "Participant";
    return fullName.split(" ")[0] || fullName;
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

      const [profileRes, activeRes, appliedRes, completedRes, catalogRes] = await Promise.all([
        fetchJson("/users/me/profile-completion", token),
        fetchJson("/projects/active", token),
        fetchJson("/projects/applied", token),
        fetchJson("/projects/completed", token),
        getActiveCatalog()
      ]);

      setProfileCompletion(Number(profileRes?.data?.percentage) || 0);
      setActiveProjects(Array.isArray(activeRes?.data) ? activeRes.data : []);
      setAppliedProjects(Array.isArray(appliedRes?.data) ? appliedRes.data : []);
      setCompletedProjects(Array.isArray(completedRes?.data) ? completedRes.data : []);
      setCatalogProjects(Array.isArray(catalogRes?.data?.data) ? catalogRes.data.data : []);
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
  const participantUploadsPath = user?.id ? `/participant/${user.id}/uploads` : "/dashboard";
  const participantRecentHistoryPath = user?.id ? `/participant/${user.id}/recent-history` : "/dashboard";

  const filteredCatalog = useMemo(() => {
    if (!searchTerm.trim()) return catalogProjects;

    const term = searchTerm.toLowerCase();
    return catalogProjects.filter((item) => {
      const title = String(item?.title || item?.name || "").toLowerCase();
      const category = String(item?.category || "").toLowerCase();
      return title.includes(term) || category.includes(term);
    });
  }, [catalogProjects, searchTerm]);

  const requestedProjects = useMemo(
    () => catalogProjects.filter((item) => String(item?.access_status || "").toUpperCase() === "PENDING"),
    [catalogProjects]
  );
  const unlockedProjects = useMemo(
    () => catalogProjects.filter((item) => String(item?.access_status || "").toUpperCase() === "APPROVED"),
    [catalogProjects]
  );

  const activeTabCount = useMemo(() => {
    const allocatedProjectIds = new Set(
      activeProjects.map((row) => row?.projects?.id).filter(Boolean)
    );
    const unlockedOnlyCount = unlockedProjects.filter(
      (project) => !allocatedProjectIds.has(project.id)
    ).length;
    return activeProjects.length + unlockedOnlyCount;
  }, [activeProjects, unlockedProjects]);

  const activeCards = useMemo(() => {
    const allocatedProjectIds = new Set(
      activeProjects.map((row) => row?.projects?.id).filter(Boolean)
    );

    const unlockedOnly = unlockedProjects
      .filter((project) => !allocatedProjectIds.has(project.id))
      .map((project) => ({ type: "unlocked", project }));

    const allocated = activeProjects.map((item) => ({ type: "allocation", item }));

    return [...allocated, ...unlockedOnly];
  }, [activeProjects, unlockedProjects]);

  const tabItems = [
    { key: "active", label: `Active Projects (${activeTabCount})` },
    { key: "applied", label: `Applied (${appliedProjects.length})` },
    { key: "completed", label: `Completed (${completedProjects.length})` }
  ];

  const activeList =
    activeTab === "active"
      ? activeProjects
      : activeTab === "applied"
        ? appliedProjects
        : completedProjects;

  const openProjectProducts = (projectId) => {
    if (!projectId || !user?.id) return;
    navigate(`/participant/${user.id}/marketplace?project=${projectId}`);
  };

  const openAllocation = (allocationId) => {
    if (!allocationId || !user?.id) return;
    navigate(`/participant/${user.id}/allocation/active?allocation=${allocationId}`);
  };

  const handleRequestAccess = async (projectId) => {
    setError("");
    setCatalogNotice("");
    setRequestingProjectId(projectId);
    try {
      const res = await requestProjectAccess(projectId);
      const status = String(res?.data?.data?.status || "PENDING").toUpperCase();

      setCatalogProjects((prev) =>
        prev.map((project) =>
          project.id === projectId
            ? { ...project, access_status: status }
            : project
        )
      );

      setCatalogNotice(
        status === "APPROVED"
          ? "Great news! Your project access is already approved. You can now view products and continue."
          : "Great choice! Your unlock request is sent. Once admin approves it, you will see the product list here."
      );
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to request project access.");
    } finally {
      setRequestingProjectId("");
    }
  };

  if (loading) {
    return <div className="participant-loading">Loading dashboard...</div>;
  }

  return (
    <div className="participant-dashboard">
      <header className="participant-topbar">
        <div className="participant-brand">Nitro</div>
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
          <button
            type="button"
            className={topNav === "uploads" ? "is-active" : ""}
            onClick={() => {
              setTopNav("uploads");
              navigate(participantUploadsPath);
            }}
          >
            Uploads
          </button>
          <button
            type="button"
            className={topNav === "recent-history" ? "is-active" : ""}
            onClick={() => {
              setTopNav("recent-history");
              navigate(participantRecentHistoryPath);
            }}
          >
            Recent History
          </button>
        </nav>
        <button type="button" className="participant-logout" onClick={handleLogout}>Logout</button>
      </header>

      <main className="participant-main">
        <section className="participant-hero">
          <div>
            <h1>Welcome back, {displayName}!</h1>
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

        <section className="participant-tabs">
          <div className="participant-tab-row">
            {tabItems.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={activeTab === tab.key ? "is-active" : ""}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "applied" ? (
            activeList.length ? (
              <div className="participant-applied-table-wrap">
                <table className="participant-applied-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Product</th>
                      <th>Reward</th>
                      <th>Status</th>
                      <th>Requested</th>
                      <th>Allocated Budget</th>
                      <th>Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeList.map((item) => {
                      const project = item?.projects || {};
                      const title = project?.title || project?.name || "Untitled Project";
                      const reward = Number(project?.reward);
                      const selectedProduct = item?.selected_product?.name || item?.project_products?.name || "-";
                      const requestedAt = item?.created_at ? new Date(item.created_at).toLocaleString() : "-";
                      const statusLabel = String(item?.status || "PENDING").toUpperCase();
                      const allocatedBudget = Number(item?.allocated_budget || 0);
                      const productValue = Number(item?.project_products?.product_value || 0);
                      const effectiveBudget = allocatedBudget > 0 ? allocatedBudget : productValue;
                      const allocationId = item?.allocation?.id || "";

                      return (
                        <tr key={`applied-${item.id}`}>
                          <td>{title}</td>
                          <td>{selectedProduct}</td>
                          <td>{Number.isFinite(reward) ? `${currency.format(reward)} + Product` : "Reward TBD"}</td>
                          <td>{statusLabel}</td>
                          <td>{requestedAt}</td>
                          <td>{effectiveBudget > 0 ? currency.format(effectiveBudget) : currency.format(0)}</td>
                          <td>
                            {allocationId ? (
                              <button
                                type="button"
                                className="participant-applied-action"
                                onClick={() => openAllocation(allocationId)}
                              >
                                Open Allocation
                              </button>
                            ) : (
                              "Pending allocation"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="participant-empty-card">No projects in this section yet.</div>
            )
          ) : (
            <div className="participant-grid">
              {activeTab === "active" ? (
                activeCards.length ? (
                  activeCards.slice(0, 3).map((card) => {
                    if (card.type === "allocation") {
                      const item = card.item;
                      const project = item?.projects || {};
                      const title = project?.title || project?.name || "Untitled Project";
                      const reward = Number(project?.reward);
                      const selectedProduct = item?.selected_product?.name || item?.project_products?.name || "";
                      const projectId = project?.id;

                      return (
                        <article key={item.id || title} className="participant-project-card">
                          <div className="participant-card-image" />
                          <div className="participant-card-body">
                            <div className="participant-card-top">
                              <span className="participant-badge">{String(project?.category || "Project").toUpperCase()}</span>
                              <span className="participant-muted">{daysLeftLabel(item?.reserved_until)}</span>
                            </div>
                            <h3>{title}</h3>
                            <p>{Number.isFinite(reward) ? `${currency.format(reward)} + Product` : "Reward TBD"}</p>
                            {selectedProduct ? <p>Product: {selectedProduct}</p> : null}
                            <button
                              type="button"
                              className="participant-proof-btn"
                              disabled={!projectId}
                              onClick={() => openProjectProducts(projectId)}
                            >
                              View Products
                            </button>
                          </div>
                        </article>
                      );
                    }

                    const project = card.project;
                    const title = project?.title || "Unlocked Project";
                    return (
                      <article key={`unlocked-${project.id}`} className="participant-project-card">
                        <div className="participant-card-image" />
                        <div className="participant-card-body">
                          <div className="participant-card-top">
                            <span className="participant-badge">{String(project?.category || "Project").toUpperCase()}</span>
                            <span className="participant-muted">UNLOCKED</span>
                          </div>
                          <h3>{title}</h3>
                          <p>{String(project?.mode || "MARKETPLACE").toUpperCase()} mode</p>
                          <button
                            type="button"
                            className="participant-proof-btn"
                            onClick={() => navigate(`/participant/${user?.id}/marketplace?project=${project.id}`)}
                          >
                            View Products
                          </button>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="participant-empty-card participant-empty-card-highlight">
                    <strong>Ready to start?</strong>
                    Explore the projects below, request unlock access for the one you like, and begin your purchase journey.
                  </div>
                )
              ) : activeList.length ? (
                activeList.slice(0, 3).map((item) => {
                  const project = item?.projects || {};
                  const title = project?.title || project?.name || "Untitled Project";
                  const reward = Number(project?.reward);
                  const allocatedBudget = Number(item?.allocated_budget || 0);
                  const selectedProduct = item?.selected_product?.name || item?.project_products?.name || "";

                  return (
                    <article key={item.id || title} className="participant-project-card">
                      <div className="participant-card-image" />
                      <div className="participant-card-body">
                        <div className="participant-card-top">
                          <span className="participant-badge">{String(project?.category || "Project").toUpperCase()}</span>
                          <span className="participant-muted">Completed</span>
                        </div>
                        <h3>{title}</h3>
                        <p>{Number.isFinite(reward) ? `${currency.format(reward)} + Product` : "Reward TBD"}</p>
                        {selectedProduct ? <p>Product: {selectedProduct}</p> : null}
                        {allocatedBudget > 0 ? <p>Allocated Budget: {currency.format(allocatedBudget)}</p> : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="participant-empty-card">No projects in this section yet.</div>
              )}
            </div>
          )}
        </section>

        <section className="participant-available">
          <div className="participant-section-head">
            <h2>Active Project Catalog</h2>
            <button type="button" onClick={() => navigate(`/participant/${user?.id}/marketplace`)}>All Projects</button>
          </div>
          {catalogNotice ? <div className="participant-notice-success" style={{ marginTop: 10 }}>{catalogNotice}</div> : null}

          <div className="participant-available-grid">
            {filteredCatalog.length ? (
              filteredCatalog.map((item) => {
                const title = item?.title || item?.name || "Untitled Project";
                const status = String(item?.access_status || "LOCKED").toUpperCase();
                const isPending = status === "PENDING";
                const isApproved = status === "APPROVED";
                const isRejected = status === "REJECTED";

                return (
                  <article key={item.id || title} className="participant-mini-card">
                    <div className="participant-mini-image" />
                    <div className="participant-mini-body">
                      <h3>{title}</h3>
                      <p>{item?.category || "General"} | {String(item?.mode || "MARKETPLACE").toUpperCase()}</p>
                      <p>Access: {status}</p>
                      {!isApproved ? (
                        <button
                          type="button"
                          className="participant-proof-btn participant-mini-action"
                          disabled={isPending || requestingProjectId === item.id}
                          onClick={() => handleRequestAccess(item.id)}
                        >
                          {requestingProjectId === item.id
                            ? "Sending..."
                            : isRejected
                              ? "Request Again"
                              : isPending
                                ? "Request Sent"
                                : "Request Unlock"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="participant-proof-btn participant-mini-action"
                          onClick={() => navigate(`/participant/${user?.id}/marketplace?project=${item.id}`)}
                        >
                          View Products
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="participant-empty-card">No active projects match your search.</div>
            )}
          </div>
        </section>

        <section className="participant-available">
          <div className="participant-section-head">
            <h2>Requested Projects</h2>
          </div>
          <div className="participant-available-grid">
            {requestedProjects.length ? (
              requestedProjects.map((item) => (
                <article key={`requested-${item.id}`} className="participant-mini-card">
                  <div className="participant-mini-image" />
                  <div className="participant-mini-body">
                    <h3>{item?.title || "Untitled Project"}</h3>
                    <p>{item?.category || "General"} | {String(item?.mode || "MARKETPLACE").toUpperCase()}</p>
                    <p>Status: PENDING ADMIN APPROVAL</p>
                  </div>
                </article>
              ))
            ) : (
              <div className="participant-empty-card">No requested projects yet.</div>
            )}
          </div>
        </section>
      </main>

      <nav className="participant-mobile-nav" aria-label="Participant mobile navigation">
        <button type="button" className="active" onClick={() => navigate(participantDashboardPath)}>Home</button>
        <button type="button" onClick={() => setActiveTab("active")}>Tasks</button>
        <button type="button" onClick={() => navigate(participantAllocationPath)}>Allocations</button>
        <button type="button" onClick={() => navigate(participantPayoutPath)}>Payouts</button>
      </nav>
    </div>
  );
};

export default ParticipantDashboard;
