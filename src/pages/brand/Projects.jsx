import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getBrandProjects } from "../../api/brand.api";
import "./Projects.css";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));

const Projects = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await getBrandProjects();
        setProjects(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load projects.");
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  const filtered = useMemo(() => {
    return projects.filter((project) => {
      const name = String(project?.title || project?.name || "").toLowerCase();
      const matchesName = !query.trim() || name.includes(query.trim().toLowerCase());
      const projectMode = String(project?.mode || "MARKETPLACE").toUpperCase();
      const projectStatus = String(project?.status || "draft").toUpperCase();
      const matchesMode = mode === "ALL" || projectMode === mode;
      const matchesStatus = status === "ALL" || projectStatus === status;
      return matchesName && matchesMode && matchesStatus;
    });
  }, [mode, projects, query, status]);

  return (
    <div className="project-page">
      <div className="project-head">
        <div>
          <h1>Active Projects</h1>
          <p>Manage and monitor your product sampling campaigns</p>
        </div>
        {location.pathname !== "/brand/projects" ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="project-create-btn"
              style={{ background: "#fff", color: "#0d2a45", border: "1px solid #c9d8e9" }}
              type="button"
              onClick={() => navigate("/dashboard")}
            >
              Back
            </button>
          <button
            className="project-create-btn"
            type="button"
            onClick={() => navigate("/projects/create")}
          >
            + Create Project
          </button>
          </div>
        ) : null}
      </div>

      <div className="project-filters">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by project name..."
        />
        <select value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="ALL">Mode: All</option>
          <option value="MARKETPLACE">Mode: Marketplace</option>
          <option value="D2C">Mode: D2C</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="ALL">Status: All</option>
          <option value="DRAFT">Status: Draft</option>
          <option value="PUBLISHED">Status: Published</option>
          <option value="ARCHIVED">Status: Archived</option>
        </select>
      </div>

      {error ? <div className="project-error">{error}</div> : null}
      {loading ? <div className="project-loading">Loading projects...</div> : null}

      <div className="project-grid">
        {filtered.map((project) => {
          const title = project?.title || project?.name || "Untitled Project";
          const totalUnits = Number(project?.total_units) || 0;
          const reward = Number(project?.reward);
          const projectMode = String(project?.mode || "MARKETPLACE").toUpperCase();

          return (
            <article
              key={project.id || title}
              className="project-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/projects/manage/${project.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/projects/manage/${project.id}`);
                }
              }}
            >
              <div className="project-image" />
              <div className="project-card-body">
                <div className={`project-tag ${projectMode === "D2C" ? "d2c" : "marketplace"}`}>
                  {projectMode}
                </div>
                <h3>{title}</h3>
                <p>Status: {String(project?.status || "draft").toUpperCase()}</p>
                <p>Units Sampled: {totalUnits}</p>
                <strong>
                  {Number.isFinite(reward) ? `Reward: ${formatCurrency(reward)}` : "Reward: TBD"}
                </strong>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default Projects;
