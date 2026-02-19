import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../api/axiosInstance";
import { getStoredToken, verifyBackendUser } from "../../lib/auth";
import "./AdminPages.css";

const Users = () => {
  const navigate = useNavigate();
  const [participants, setParticipants] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const loadUsers = async () => {
    setError("");
    setLoading(true);
    try {
      const requests = [axios.get("/admin/participants")];
      if (isSuperAdmin) {
        requests.push(axios.get("/admin/admins"));
      }

      const [participantsRes, adminsRes] = await Promise.all(requests);
      setParticipants(Array.isArray(participantsRes.data?.data) ? participantsRes.data.data : []);
      setAdmins(Array.isArray(adminsRes?.data?.data) ? adminsRes.data.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [isSuperAdmin]);

  useEffect(() => {
    const loadRole = async () => {
      try {
        const token = getStoredToken();
        if (!token) return;
        const me = await verifyBackendUser(token);
        setIsSuperAdmin(String(me?.role || "").toUpperCase() === "SUPER_ADMIN");
      } catch {
        setIsSuperAdmin(false);
      }
    };

    loadRole();
  }, []);

  const updateStatus = async (id, action) => {
    try {
      await axios.patch(`/admin/participants/${id}/${action}`);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} participant`);
    }
  };

  const deleteParticipant = async (id) => {
    try {
      await axios.delete(`/admin/participants/${id}`);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete participant");
    }
  };

  const promoteToAdmin = async (id) => {
    try {
      await axios.patch(`/admin/participants/${id}/promote-admin`);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to promote participant");
    }
  };

  const removeAdminAccess = async (id) => {
    try {
      await axios.patch(`/admin/admins/${id}/remove-access`);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove admin access");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Participants</h1>
          <p>Approve and manage participant access</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="admin-btn" onClick={() => navigate("/dashboard")}>Back</button>
          <button type="button" className="admin-btn" onClick={loadUsers}>Refresh</button>
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-panel admin-table-wrap">
        <h2>Participants</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}>Loading participants...</td></tr>
            ) : participants.length ? (
              participants.map((user) => (
                <tr key={user.id}>
                  <td>{user.full_name || "-"}</td>
                  <td>{user.email || "-"}</td>
                  <td>
                    <span className={`admin-badge ${String(user.status || "").toLowerCase()}`}>
                      {user.status || "UNKNOWN"}
                    </span>
                  </td>
                  <td>{user.created_at ? new Date(user.created_at).toLocaleString() : "-"}</td>
                  <td>
                    <div className="admin-actions">
                      {isSuperAdmin ? (
                        <button
                          type="button"
                          className="admin-btn"
                          onClick={() => navigate(`/super-admin/participants/${user.id}`)}
                        >
                          View Details
                        </button>
                      ) : null}

                      {user.status === "PENDING" ? (
                        <>
                          <button
                            type="button"
                            className="admin-btn"
                            onClick={() => updateStatus(user.id, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="admin-btn"
                            onClick={() => updateStatus(user.id, "reject")}
                          >
                            Reject
                          </button>
                        </>
                      ) : null}

                      {user.status === "APPROVED" ? (
                        <button
                          type="button"
                          className="admin-btn"
                          onClick={() => updateStatus(user.id, "reject")}
                        >
                          Reject
                        </button>
                      ) : null}

                      {user.status === "REJECTED" ? (
                        <button
                          type="button"
                          className="admin-btn"
                          onClick={() => deleteParticipant(user.id)}
                        >
                          Delete
                        </button>
                      ) : null}
                      {isSuperAdmin ? (
                        <button
                          type="button"
                          className="admin-btn"
                          onClick={() => promoteToAdmin(user.id)}
                          disabled={user.status !== "APPROVED"}
                        >
                          Make Admin
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td className="admin-empty" colSpan={5}>No participants found.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {isSuperAdmin ? (
        <section className="admin-panel admin-table-wrap" style={{ marginTop: 16 }}>
          <h2>Admins</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5}>Loading admins...</td></tr>
              ) : admins.length ? (
                admins.map((user) => (
                  <tr key={user.id}>
                    <td>{user.full_name || "-"}</td>
                    <td>{user.email || "-"}</td>
                    <td>
                      <span className={`admin-badge ${String(user.status || "").toLowerCase()}`}>
                        {user.status || "UNKNOWN"}
                      </span>
                    </td>
                    <td>{user.created_at ? new Date(user.created_at).toLocaleString() : "-"}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() => removeAdminAccess(user.id)}
                      >
                        Remove Admin Access
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td className="admin-empty" colSpan={5}>No admins found.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
};

export default Users;
