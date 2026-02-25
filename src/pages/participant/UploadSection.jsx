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

  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data;
};

const UploadSection = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [allocationTracking, setAllocationTracking] = useState([]);

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
        const trackingRes = await fetchJson("/allocations/my/tracking", token);
        setAllocationTracking(Array.isArray(trackingRes?.data) ? trackingRes.data : []);
      } catch (err) {
        if (/token|unauthorized|expired|forbidden/i.test(err.message || "")) {
          clearStoredTokens();
          navigate("/login", { replace: true });
          return;
        }
        setError(err.message || "Unable to load upload history.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate]);

  const uploadHistory = useMemo(() => (
    allocationTracking
      .filter((row) => row?.purchase_proof?.created_at || row?.purchase_proof?.uploaded_at)
      .map((row) => {
        const projectName = row?.projects?.title || row?.projects?.name || "Untitled Project";
        const productName = row?.selected_product?.name || "Product not linked";
        const proofStatus = String(row?.purchase_proof?.status || "PENDING").toUpperCase();
        return {
          key: `up-${row?.purchase_proof?.id || row?.id}`,
          at: row?.purchase_proof?.created_at || row?.purchase_proof?.uploaded_at,
          projectName,
          productName,
          status: proofStatus,
          proofUrl: row?.purchase_proof?.file_url || "",
          text: `Invoice uploaded to ${projectName}`
        };
      })
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
  ), [allocationTracking]);

  const reviewHistory = useMemo(() => (
    allocationTracking
      .filter((row) => row?.review_submission?.created_at)
      .map((row) => {
        const projectName = row?.projects?.title || row?.projects?.name || "Untitled Project";
        const productName = row?.selected_product?.name || "Product not linked";
        const reviewStatus = String(row?.review_submission?.status || "PENDING").toUpperCase();
        return {
          key: `rv-${row?.review_submission?.id || row?.id}`,
          at: row?.review_submission?.created_at,
          projectName,
          productName,
          status: reviewStatus,
          reviewText: String(row?.review_submission?.review_text || "").trim(),
          reviewUrl: row?.review_submission?.review_url || "",
          text: `Review uploaded to ${projectName}`
        };
      })
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
  ), [allocationTracking]);

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
          <button type="button" className="is-active" onClick={() => navigate(participantUploadsPath)}>Uploads</button>
          <button type="button" onClick={() => navigate(participantRecentHistoryPath)}>Recent History</button>
        </nav>
        <button type="button" className="participant-logout" onClick={handleLogout}>Logout</button>
      </header>

      <main className="participant-main">
        <section className="participant-history">
          <div className="participant-section-head">
            <h2>Upload Section</h2>
          </div>
          {error ? <div className="participant-alert">{error}</div> : null}
          {loading ? <div className="participant-empty-card">Loading upload history...</div> : null}
          {!loading ? (
            <div className="participant-history-grid participant-history-grid-stack">
              <article className="participant-history-card">
                <h3>Invoice Upload History</h3>
                {uploadHistory.length ? (
                  <div className="participant-applied-table-wrap">
                    <table className="participant-applied-table">
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Product</th>
                          <th>Upload</th>
                          <th>Status</th>
                          <th>Date & Time</th>
                          <th>Proof</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadHistory.map((item) => (
                          <tr key={item.key}>
                            <td>{item.projectName}</td>
                            <td>{item.productName}</td>
                            <td>Invoice</td>
                            <td>{item.status}</td>
                            <td>{item.at ? new Date(item.at).toLocaleString() : "-"}</td>
                            <td>
                              {item.proofUrl ? (
                                <a href={item.proofUrl} target="_blank" rel="noreferrer">View</a>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>No invoice uploads yet.</p>
                )}
              </article>

              <article className="participant-history-card">
                <h3>Review Upload History</h3>
                {reviewHistory.length ? (
                  <div className="participant-applied-table-wrap">
                    <table className="participant-applied-table">
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Product</th>
                          <th>Upload</th>
                          <th>Status</th>
                          <th>Date & Time</th>
                          <th>Review</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewHistory.map((item) => (
                          <tr key={item.key}>
                            <td>{item.projectName}</td>
                            <td>{item.productName}</td>
                            <td>Review</td>
                            <td>{item.status}</td>
                            <td>{item.at ? new Date(item.at).toLocaleString() : "-"}</td>
                            <td>
                              {item.reviewUrl ? (
                                <a href={item.reviewUrl} target="_blank" rel="noreferrer">View</a>
                              ) : item.reviewText ? (
                                item.reviewText.length > 120
                                  ? `${item.reviewText.slice(0, 120)}...`
                                  : item.reviewText
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>No review uploads yet.</p>
                )}
              </article>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
};

export default UploadSection;
