import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  approveParticipant,
  getAllParticipants,
  rejectParticipant
} from "../../api/admin.api";

const LoginRequests = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [workingId, setWorkingId] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAllParticipants();
      const allRows = Array.isArray(res?.data?.data) ? res.data.data : [];
      const filtered = statusFilter === "ALL"
        ? allRows
        : allRows.filter((row) => String(row?.status || "").toUpperCase() === statusFilter);
      setRows(filtered);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load login requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const onApprove = async (id) => {
    setWorkingId(`approve-${id}`);
    try {
      await approveParticipant(id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to approve participant.");
    } finally {
      setWorkingId("");
    }
  };

  const onReject = async (id) => {
    setWorkingId(`reject-${id}`);
    try {
      await rejectParticipant(id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to reject participant.");
    } finally {
      setWorkingId("");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Login Requests</h1>
          <p>Pending participant registration approvals</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="admin-btn" onClick={() => navigate("/admin/applications")}>Back</button>
          <button type="button" className="admin-btn" onClick={load}>Refresh</button>
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-panel admin-table-wrap">
        <div className="admin-actions" style={{ marginBottom: 10, gap: 10 }}>
          <label htmlFor="login-status-filter">Status</label>
          <select
            id="login-status-filter"
            className="form-select"
            style={{ maxWidth: 220 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ALL">All</option>
          </select>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Requested At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}>Loading login requests...</td></tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.full_name || "-"}</td>
                  <td>{row.email || "-"}</td>
                  <td>{row.status || "PENDING"}</td>
                  <td>{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                  <td>
                    {String(row?.status || "").toUpperCase() === "PENDING" ? (
                      <div className="admin-actions">
                        <button type="button" className="admin-btn" onClick={() => onApprove(row.id)} disabled={workingId === `approve-${row.id}`}>Approve</button>
                        <button type="button" className="admin-btn" onClick={() => onReject(row.id)} disabled={workingId === `reject-${row.id}`}>Reject</button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="admin-empty">No login requests for selected status.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default LoginRequests;
