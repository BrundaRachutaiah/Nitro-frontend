import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../api/axiosInstance";
import "./AdminPages.css";

const AuditLogs = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await axios.get("/admin/activity?limit=50");
      setLogs(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Audit Logs</h1>
          <p>Track admin operations and system activity</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="admin-btn" onClick={() => navigate("/dashboard")}>Back</button>
          <button type="button" className="admin-btn" onClick={loadLogs}>Refresh</button>
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-panel admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Entity</th>
              <th>Message</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4}>Loading logs...</td></tr>
            ) : logs.length ? (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.action || "-"}</td>
                  <td>{log.entity_type || "-"}</td>
                  <td>{log.message || "-"}</td>
                  <td>{log.created_at ? new Date(log.created_at).toLocaleString() : "-"}</td>
                </tr>
              ))
            ) : (
              <tr><td className="admin-empty" colSpan={4}>No logs found.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default AuditLogs;
