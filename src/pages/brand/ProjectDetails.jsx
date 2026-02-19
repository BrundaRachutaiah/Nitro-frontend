import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBrandProjects, updateProject, updateProjectStatus } from "../../api/brand.api";
import { getStoredToken, verifyBackendUser } from "../../lib/auth";
import "./Projects.css";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));

const blankProduct = { name: "", product_url: "", price: "" };

const ProjectDetails = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    category: "",
    reward: "",
    mode: "MARKETPLACE",
    total_units: "",
    start_date: "",
    end_date: "",
    product_url: "",
    products: [{ ...blankProduct }]
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const token = getStoredToken();
        if (token) {
          const me = await verifyBackendUser(token);
          setRole(String(me?.role || "").toUpperCase());
        }

        const res = await getBrandProjects();
        setProjects(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load project details.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [projectId]);

  const project = useMemo(
    () => projects.find((item) => String(item.id) === String(projectId)) || null,
    [projects, projectId]
  );

  useEffect(() => {
    if (!project) return;
    setEditForm({
      title: project.title || project.name || "",
      description: project.description || "",
      category: project.category || "",
      reward: project.reward ?? "",
      mode: project.mode || "MARKETPLACE",
      total_units: project.total_units ?? "",
      start_date: project.start_date ? String(project.start_date).slice(0, 10) : "",
      end_date: project.end_date ? String(project.end_date).slice(0, 10) : "",
      product_url: project.product_url || "",
      products: Array.isArray(project.project_products) && project.project_products.length
        ? project.project_products.map((item) => ({
            name: item?.name || "",
            product_url: item?.product_url || "",
            price: item?.product_value ?? ""
          }))
        : [{ ...blankProduct }]
    });
  }, [project]);

  const refreshProject = async () => {
    const res = await getBrandProjects();
    setProjects(Array.isArray(res.data?.data) ? res.data.data : []);
  };

  const onStatusChange = async (status) => {
    if (!project?.id) return;
    setStatusBusy(true);
    setError("");
    try {
      await updateProjectStatus(project.id, status);
      await refreshProject();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update project status.");
    } finally {
      setStatusBusy(false);
    }
  };

  const onSaveDraft = async () => {
    if (!project?.id) return;
    setSaveBusy(true);
    setError("");
    try {
      await updateProject(project.id, {
        name: editForm.title,
        title: editForm.title,
        description: editForm.description,
        category: editForm.category,
        reward: Number(editForm.reward || 0),
        mode: editForm.mode,
        total_units: Number(editForm.total_units || 0),
        start_date: editForm.start_date,
        end_date: editForm.end_date,
        product_url: editForm.product_url,
        products: editForm.products
          .map((item) => ({
            name: String(item?.name || "").trim(),
            product_url: String(item?.product_url || "").trim(),
            price: Number(item?.price || 0),
            product_value: Number(item?.price || 0)
          }))
          .filter((item) => item.name && item.product_url)
      });
      await refreshProject();
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update draft project.");
    } finally {
      setSaveBusy(false);
    }
  };

  const updateEditProduct = (index, key, value) => {
    setEditForm((prev) => {
      const next = [...prev.products];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, products: next };
    });
  };

  const addEditProduct = () => {
    setEditForm((prev) => ({
      ...prev,
      products: [...prev.products, { ...blankProduct }]
    }));
  };

  const removeEditProduct = (index) => {
    setEditForm((prev) => {
      if (prev.products.length <= 1) return prev;
      return {
        ...prev,
        products: prev.products.filter((_, idx) => idx !== index)
      };
    });
  };

  if (loading) return <div className="project-loading">Loading project details...</div>;

  return (
    <div className="project-page">
      <div className="project-head">
        <div>
          <h1>{project?.title || project?.name || "Project Details"}</h1>
          <p>Project details and products</p>
        </div>
        <button
          className="project-create-btn"
          style={{ background: "#fff", color: "#0d2a45", border: "1px solid #c9d8e9" }}
          type="button"
          onClick={() => navigate("/projects/manage")}
        >
          Back to Projects
        </button>
      </div>

      {error ? <div className="project-error">{error}</div> : null}
      {!project && !error ? <div className="project-error">Project not found.</div> : null}

      {project ? (
        <section className="project-detail-panel">
          <div className="project-detail-grid">
            <p><strong>Category:</strong> {project.category || "-"}</p>
            <p><strong>Mode:</strong> {project.mode || "-"}</p>
            <p><strong>Status:</strong> {String(project.status || "-").toUpperCase()}</p>
            <p><strong>Reward:</strong> {Number.isFinite(Number(project.reward)) ? formatCurrency(project.reward) : "-"}</p>
            <p><strong>Total Units:</strong> {project.total_units || "-"}</p>
            <p><strong>Start Date:</strong> {project.start_date ? new Date(project.start_date).toLocaleDateString() : "-"}</p>
            <p><strong>End Date:</strong> {project.end_date ? new Date(project.end_date).toLocaleDateString() : "-"}</p>
          </div>

          {(role === "ADMIN" || role === "SUPER_ADMIN") ? (
            <div style={{ display: "flex", gap: 10, margin: "8px 0 16px" }}>
              {role === "SUPER_ADMIN" && String(project.status || "").toLowerCase() === "draft" ? (
                <button
                  type="button"
                  className="project-create-btn"
                  style={{ background: "#fff", color: "#0d2a45", border: "1px solid #c9d8e9" }}
                  onClick={() => setIsEditing((prev) => !prev)}
                >
                  {isEditing ? "Close Edit" : "Edit Draft"}
                </button>
              ) : null}
              <button
                type="button"
                className="project-create-btn"
                onClick={() => onStatusChange("published")}
                disabled={statusBusy || String(project.status || "").toLowerCase() === "published"}
              >
                {statusBusy ? "Updating..." : "Publish"}
              </button>
              <button
                type="button"
                className="project-create-btn"
                style={{ background: "#fff", color: "#0d2a45", border: "1px solid #c9d8e9" }}
                onClick={() => onStatusChange("archived")}
                disabled={statusBusy || String(project.status || "").toLowerCase() === "archived"}
              >
                Archive
              </button>
            </div>
          ) : null}

          {role === "SUPER_ADMIN" && isEditing && String(project.status || "").toLowerCase() === "draft" ? (
            <div className="project-detail-panel" style={{ margin: "0 0 16px" }}>
              <h3 style={{ marginTop: 0 }}>Edit Draft Project</h3>
              <div style={{ display: "grid", gap: 10, maxWidth: 920 }}>
                <input className="form-control" placeholder="Project Title" value={editForm.title} onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))} />
                <textarea className="form-control" placeholder="Project Description" value={editForm.description} onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))} />
                <input className="form-control" placeholder="Category" value={editForm.category} onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))} />
                <input className="form-control" type="number" placeholder="Reward Amount (INR)" value={editForm.reward} onChange={(e) => setEditForm((prev) => ({ ...prev, reward: e.target.value }))} />
                <select className="form-select" value={editForm.mode} onChange={(e) => setEditForm((prev) => ({ ...prev, mode: e.target.value }))}>
                  <option value="MARKETPLACE">MARKETPLACE</option>
                  <option value="D2C">D2C</option>
                </select>
                <input className="form-control" type="number" placeholder="Total Units" value={editForm.total_units} onChange={(e) => setEditForm((prev) => ({ ...prev, total_units: e.target.value }))} />
                <input className="form-control" type="date" value={editForm.start_date} onChange={(e) => setEditForm((prev) => ({ ...prev, start_date: e.target.value }))} />
                <input className="form-control" type="date" value={editForm.end_date} onChange={(e) => setEditForm((prev) => ({ ...prev, end_date: e.target.value }))} />
                <input className="form-control" placeholder="Primary Product URL (optional)" value={editForm.product_url} onChange={(e) => setEditForm((prev) => ({ ...prev, product_url: e.target.value }))} />
                <h4 style={{ margin: "4px 0 0" }}>Products</h4>
                {editForm.products.map((product, idx) => (
                  <div key={`edit-product-${idx}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 180px 120px", gap: 8 }}>
                    <input
                      className="form-control"
                      placeholder="Product Name"
                      value={product.name}
                      onChange={(e) => updateEditProduct(idx, "name", e.target.value)}
                    />
                    <input
                      className="form-control"
                      placeholder="Product URL"
                      value={product.product_url}
                      onChange={(e) => updateEditProduct(idx, "product_url", e.target.value)}
                    />
                    <input
                      className="form-control"
                      type="number"
                      placeholder="Price (INR)"
                      value={product.price}
                      onChange={(e) => updateEditProduct(idx, "price", e.target.value)}
                    />
                    <button type="button" className="admin-btn" onClick={() => removeEditProduct(idx)}>Remove</button>
                  </div>
                ))}
                <button type="button" className="admin-btn" onClick={addEditProduct} style={{ width: "fit-content" }}>
                  + Add Product
                </button>

                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" className="project-create-btn" onClick={onSaveDraft} disabled={saveBusy}>
                    {saveBusy ? "Saving..." : "Save Draft"}
                  </button>
                  <button
                    type="button"
                    className="project-create-btn"
                    style={{ background: "#fff", color: "#0d2a45", border: "1px solid #c9d8e9" }}
                    onClick={() => setIsEditing(false)}
                    disabled={saveBusy}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <p className="project-detail-description">{project.description || "No description available."}</p>

          <div className="project-products-table-wrap">
            <h3>Project Products</h3>
            <table className="project-products-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Product URL</th>
                  <th>Price (INR)</th>
                </tr>
              </thead>
              <tbody>
                {(project.project_products || []).length ? (
                  project.project_products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name || "-"}</td>
                      <td>
                        {product.product_url ? (
                          <a href={product.product_url} target="_blank" rel="noreferrer">
                            Open Link
                          </a>
                        ) : "-"}
                      </td>
                      <td>{formatCurrency(product.product_value || 0)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>No products found for this project.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default ProjectDetails;
