import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../api/axiosInstance";
import "./AdminPages.css";

const Brands = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await axios.get("/projects");
      setProjects(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Projects</h1>
          <p>Global campaign list for super admin review</p>
        </div>
        <div className="admin-head-actions">
          <button className="admin-btn" onClick={() => navigate("/dashboard")}>Back</button>
          <button className="admin-btn" onClick={loadProjects}>Refresh</button>
        </div>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      <section className="admin-panel admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Created By</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Reward</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}>Loading projects...</td></tr>
            ) : projects.length ? (
              projects.map((project) => (
                <tr key={project.id}>
                  <td>{project.title || project.name || "-"}</td>
                  <td>{project.created_by || "-"}</td>
                  <td>{project.mode || "-"}</td>
                  <td>{project.status || "-"}</td>
                  <td>{project.reward ?? "-"}</td>
                  <td>{project.created_at ? new Date(project.created_at).toLocaleString() : "-"}</td>
                </tr>
              ))
            ) : (
              <tr><td className="admin-empty" colSpan={6}>No projects found.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default Brands;
