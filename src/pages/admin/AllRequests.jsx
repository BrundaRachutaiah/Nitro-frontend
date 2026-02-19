import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllParticipants,
  getProductApplications,
  getProjectAccessRequests
} from "../../api/admin.api";

const AllRequests = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [data, setData] = useState({
    loginRequests: [],
    unlockRequests: [],
    productApplications: []
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [loginRes, unlockRes, productRes] = await Promise.all([
        getAllParticipants(),
        getProjectAccessRequests({ status: statusFilter }),
        getProductApplications({ status: statusFilter })
      ]);

      const allParticipants = Array.isArray(loginRes?.data?.data) ? loginRes.data.data : [];
      const loginRequests = statusFilter === "ALL"
        ? allParticipants
        : allParticipants.filter((row) => String(row.status || "").toUpperCase() === statusFilter);

      setData({
        loginRequests,
        unlockRequests: Array.isArray(unlockRes?.data?.data) ? unlockRes.data.data : [],
        productApplications: Array.isArray(productRes?.data?.data) ? productRes.data.data : []
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load all requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>All Requests</h1>
          <p>Combined view of login, project unlock, and product application history</p>
        </div>
        <div className="admin-head-actions">
          <select className="form-select" style={{ minWidth: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button type="button" className="admin-btn" onClick={() => navigate("/admin/applications")}>Back</button>
          <button type="button" className="admin-btn" onClick={load}>Refresh</button>
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-panel mt-3">
        <h2>Summary</h2>
        {loading ? (
          <p>Loading all queues...</p>
        ) : (
          <p>
            Login: {data.loginRequests.length} | Project Unlock: {data.unlockRequests.length} | Product Applications: {data.productApplications.length}
          </p>
        )}
      </section>

      <section className="admin-panel admin-table-wrap mt-3">
        <h2>Login Requests</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Requested At</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4}>Loading...</td></tr>
            ) : data.loginRequests.length ? (
              data.loginRequests.map((row) => (
                <tr key={row.id}>
                  <td>{row.full_name || "-"}</td>
                  <td>{row.email || "-"}</td>
                  <td>{row.status || "-"}</td>
                  <td>{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="admin-empty">No login requests found.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="admin-panel admin-table-wrap mt-3">
        <h2>Project Unlock Requests</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Participant</th>
              <th>Project</th>
              <th>Status</th>
              <th>Requested At</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4}>Loading...</td></tr>
            ) : data.unlockRequests.length ? (
              data.unlockRequests.map((row) => (
                <tr key={row.id}>
                  <td>{row?.profiles?.full_name || row?.participant_id || "-"}</td>
                  <td>{row?.projects?.title || row?.project_id || "-"}</td>
                  <td>{row.status || "-"}</td>
                  <td>{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="admin-empty">No project unlock requests found.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="admin-panel admin-table-wrap mt-3">
        <h2>Product Applications</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Participant</th>
              <th>Project</th>
              <th>Product</th>
              <th>Status</th>
              <th>Requested At</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}>Loading...</td></tr>
            ) : data.productApplications.length ? (
              data.productApplications.map((row) => (
                <tr key={row.id}>
                  <td>{row?.profiles?.full_name || row?.participant_id || "-"}</td>
                  <td>{row?.projects?.title || row?.project_id || "-"}</td>
                  <td>{row?.project_products?.name || row?.product_id || "-"}</td>
                  <td>{row.status || "-"}</td>
                  <td>{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="admin-empty">No product applications found.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default AllRequests;
