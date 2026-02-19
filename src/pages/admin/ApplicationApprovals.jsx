import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getApplicationSummary
} from "../../api/admin.api";

const ApplicationApprovals = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [summary, setSummary] = useState({
    login_requests: { pending_count: 0, approved_count: 0, rejected_count: 0, total_requested: 0 },
    project_unlock_requests: { pending_count: 0, approved_count: 0, rejected_count: 0, total_requested: 0 },
    product_applications: { pending_count: 0, approved_count: 0, rejected_count: 0, total_requested: 0 },
    invoice_submissions: { pending_count: 0, approved_count: 0, rejected_count: 0, total_requested: 0 },
    review_submissions: { pending_count: 0, approved_count: 0, rejected_count: 0, total_requested: 0 },
    final_summary: { pending_total: 0, total_approved: 0, total_rejected: 0, total_requested: 0 }
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getApplicationSummary();
      setSummary(response?.data?.data || summary);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load application summary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rows = [
    {
      key: "login_requests",
      label: "Login Request for Participant",
      pending: summary?.login_requests?.pending_count || 0,
      approved: summary?.login_requests?.approved_count || 0,
      rejected: summary?.login_requests?.rejected_count || 0,
      total: summary?.login_requests?.total_requested || 0,
      path: "/admin/applications/login-requests"
    },
    {
      key: "project_unlock_requests",
      label: "Project Unlock Requests",
      pending: summary?.project_unlock_requests?.pending_count || 0,
      approved: summary?.project_unlock_requests?.approved_count || 0,
      rejected: summary?.project_unlock_requests?.rejected_count || 0,
      total: summary?.project_unlock_requests?.total_requested || 0,
      path: "/admin/applications/project-unlock-requests"
    },
    {
      key: "product_applications",
      label: "Product Applications",
      pending: summary?.product_applications?.pending_count || 0,
      approved: summary?.product_applications?.approved_count || 0,
      rejected: summary?.product_applications?.rejected_count || 0,
      total: summary?.product_applications?.total_requested || 0,
      path: "/admin/applications/product-applications"
    },
    {
      key: "invoice_submissions",
      label: "Invoice Upload Submissions",
      pending: summary?.invoice_submissions?.pending_count || 0,
      approved: summary?.invoice_submissions?.approved_count || 0,
      rejected: summary?.invoice_submissions?.rejected_count || 0,
      total: summary?.invoice_submissions?.total_requested || 0,
      path: "/admin/verification?uploadType=invoice&status=ALL"
    },
    {
      key: "review_submissions",
      label: "Review Upload Submissions",
      pending: summary?.review_submissions?.pending_count || 0,
      approved: summary?.review_submissions?.approved_count || 0,
      rejected: summary?.review_submissions?.rejected_count || 0,
      total: summary?.review_submissions?.total_requested || 0,
      path: "/admin/verification?uploadType=review&status=ALL"
    }
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Application Summary</h1>
          <p>Track and open each approval queue in a separate page</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="admin-btn" onClick={() => navigate("/dashboard")}>Back</button>
          <button type="button" className="admin-btn" onClick={load}>Refresh</button>
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}
      {loading ? <div className="admin-loading">Loading summary...</div> : null}
      {!loading ? (
        <p className="admin-muted">
          Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : "-"}
        </p>
      ) : null}

      {!loading ? (
        <section className="admin-panel admin-table-wrap">
          <h2>Requests</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Pending</th>
                <th>Approved</th>
                <th>Rejected</th>
                <th>Total</th>
                <th>Open Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td><strong>{row.pending}</strong></td>
                  <td>{row.approved}</td>
                  <td>{row.rejected}</td>
                  <td>{row.total === 0 ? "No Requests" : row.total}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => navigate(row.path)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td><strong>Final Summary</strong></td>
                <td><strong>{summary?.final_summary?.pending_total || 0}</strong></td>
                <td><strong>{summary?.final_summary?.total_approved || 0}</strong></td>
                <td><strong>{summary?.final_summary?.total_rejected || 0}</strong></td>
                <td><strong>{summary?.final_summary?.total_requested || 0}</strong></td>
                <td>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => navigate("/admin/applications/all-requests")}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
};

export default ApplicationApprovals;
