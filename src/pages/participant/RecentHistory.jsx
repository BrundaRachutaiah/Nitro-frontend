import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  API_BASE_URL,
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase
} from "../../lib/auth";
import "./Dashboard.css";

const fetchJson = async (path, token) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Request failed");
  return data;
};

const RecentHistory = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [appliedProjects, setAppliedProjects] = useState([]);
  const [allocationTracking, setAllocationTracking] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);

  const participantDashboardPath = id ? `/participant/${id}/dashboard` : "/dashboard";
  const participantPayoutPath = id ? `/participant/${id}/payouts` : "/dashboard";
  const participantProfilePath = id ? `/participant/${id}/profile` : "/dashboard";
  const participantUploadsPath = id ? `/participant/${id}/uploads` : "/dashboard";
  const participantRecentHistoryPath = id ? `/participant/${id}/recent-history` : "/dashboard";

  useEffect(() => {
    const load = async () => {
      const token = getStoredToken();
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      setLoading(true);
      setError("");
      try {
        const [appliedRes, trackingRes, accessReqRes] = await Promise.all([
          fetchJson("/projects/applied", token),
          fetchJson("/allocations/my/tracking", token),
          fetchJson("/projects/access-requests/my", token)
        ]);
        setAppliedProjects(Array.isArray(appliedRes?.data) ? appliedRes.data : []);
        setAllocationTracking(Array.isArray(trackingRes?.data) ? trackingRes.data : []);
        setAccessRequests(Array.isArray(accessReqRes?.data) ? accessReqRes.data : []);
      } catch (err) {
        if (/token|unauthorized|expired|forbidden/i.test(err.message || "")) {
          clearStoredTokens();
          navigate("/login", { replace: true });
          return;
        }
        setError(err.message || "Unable to load recent history.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate]);

  const recentActivity = useMemo(() => {
    const unlockActivities = accessRequests.map((row) => {
      const projectName = row?.projects?.title || row?.projects?.name || "Untitled Project";
      return {
        key: `unlock-${row?.id}`,
        at: row?.created_at,
        activity: "Unlock Request",
        details: `Unlock requested for ${projectName}`,
        status: String(row?.status || "PENDING").toUpperCase()
      };
    });

    const productRequestActivities = appliedProjects.map((row) => {
      const projectName = row?.projects?.title || row?.projects?.name || "Untitled Project";
      const productName = row?.selected_product?.name || row?.project_products?.name || "Selected product";
      return {
        key: `apply-${row?.id}`,
        at: row?.created_at,
        activity: "Product Request",
        details: `Requested ${productName} in ${projectName}`,
        status: String(row?.status || "PENDING").toUpperCase()
      };
    });

    const invoiceActivities = allocationTracking
      .filter((row) => row?.purchase_proof?.created_at || row?.purchase_proof?.uploaded_at)
      .map((row) => {
        const projectName = row?.projects?.title || row?.projects?.name || "Untitled Project";
        return {
          key: `invoice-${row?.purchase_proof?.id || row?.id}`,
          at: row?.purchase_proof?.created_at || row?.purchase_proof?.uploaded_at,
          activity: "Invoice Upload",
          details: `Invoice uploaded for ${projectName}`,
          status: String(row?.purchase_proof?.status || "PENDING").toUpperCase()
        };
      });

    const reviewActivities = allocationTracking
      .filter((row) => row?.review_submission?.created_at)
      .map((row) => {
        const projectName = row?.projects?.title || row?.projects?.name || "Untitled Project";
        return {
          key: `review-${row?.review_submission?.id || row?.id}`,
          at: row?.review_submission?.created_at,
          activity: "Review Upload",
          details: `Review uploaded for ${projectName}`,
          status: String(row?.review_submission?.status || "PENDING").toUpperCase()
        };
      });

    return [...unlockActivities, ...productRequestActivities, ...invoiceActivities, ...reviewActivities]
      .filter((item) => item.at)
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  }, [accessRequests, appliedProjects, allocationTracking]);

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  return (
    <div className="participant-dashboard">
      <header className="participant-topbar">
        <div className="participant-brand">Nitro</div>
        <div className="participant-search-wrap">
          <input type="text" className="participant-search" placeholder="Search projects..." readOnly />
        </div>
        <nav className="participant-nav-links">
          <button type="button" onClick={() => navigate(participantDashboardPath)}>Dashboard</button>
          <button type="button" onClick={() => navigate(participantPayoutPath)}>Payouts</button>
          <button type="button" onClick={() => navigate(participantProfilePath)}>Profile</button>
          <button type="button" onClick={() => navigate(participantUploadsPath)}>Uploads</button>
          <button type="button" className="is-active" onClick={() => navigate(participantRecentHistoryPath)}>Recent History</button>
        </nav>
        <button type="button" className="participant-logout" onClick={handleLogout}>Logout</button>
      </header>

      <main className="participant-main">
        <section className="participant-history">
          <div className="participant-section-head">
            <h2>Recent Activity</h2>
          </div>
          {error ? <div className="participant-alert">{error}</div> : null}
          {loading ? <div className="participant-empty-card">Loading recent activity...</div> : null}
          {!loading ? (
            <article className="participant-history-card participant-history-feed">
              {recentActivity.length ? (
                <ul>
                  {recentActivity.map((item) => (
                    <li key={item.key}>
                      <div className="participant-history-item-head">
                        <strong>{item.activity}</strong>
                        <span>{item.status}</span>
                      </div>
                      <p>{item.details}</p>
                      <small>{item.at ? new Date(item.at).toLocaleString() : "-"}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No recent activity yet.</p>
              )}
            </article>
          ) : null}
        </section>
      </main>
    </div>
  );
};

export default RecentHistory;
