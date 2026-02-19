import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  approveProjectAccess,
  getProjectAccessRequests,
  rejectProjectAccess
} from "../../api/admin.api";

const ProjectUnlockRequests = () => {
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
      const res = await getProjectAccessRequests({ status: statusFilter });
      setRows(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load project unlock requests.");
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
      await approveProjectAccess(id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to approve project unlock request.");
    } finally {
      setWorkingId("");
    }
  };

  const onReject = async (id) => {
    setWorkingId(`reject-${id}`);
    try {
      await rejectProjectAccess(id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to reject project unlock request.");
    } finally {
      setWorkingId("");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Project Unlock Requests</h1>
          <p>Participants requesting access to view project products</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="admin-btn" onClick={() => navigate("/admin/applications")}>Back</button>
          <button type="button" className="admin-btn" onClick={load}>Refresh</button>
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-panel admin-table-wrap">
        <div className="admin-actions" style={{ marginBottom: 10, gap: 10 }}>
          <label htmlFor="unlock-status-filter">Status</label>
          <select
            id="unlock-status-filter"
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
              <th>Participant</th>
              <th>Email</th>
              <th>Project</th>
              <th>Mode</th>
              <th>Requested At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}>Loading project unlock requests...</td></tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row?.profiles?.full_name || row?.participant_id}</td>
                  <td>{row?.profiles?.email || "-"}</td>
                  <td>{row?.projects?.title || row?.project_id}</td>
                  <td>{row?.projects?.mode || "-"}</td>
                  <td>{row?.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
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
              <tr><td colSpan={6} className="admin-empty">No project unlock requests for selected status.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default ProjectUnlockRequests;
