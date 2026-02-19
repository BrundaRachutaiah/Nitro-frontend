import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { applyForProject, getMyApplications, getPaymentDetails } from "../../api/allocation.api";
import {
  getActiveCatalog,
  getProjectById,
  getProjectProducts,
  requestProjectAccess
} from "../../api/project.api";
import "./Marketplace.css";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-IN");
};

const formatNumber = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString("en-IN");
};

const Marketplace = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const projectIdFromQuery = searchParams.get("project");
  const [mode, setMode] = useState("MARKETPLACE");
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [applyingProductId, setApplyingProductId] = useState("");
  const [myApplications, setMyApplications] = useState([]);
  const [hasPaymentDetails, setHasPaymentDetails] = useState(false);
  const [applyProduct, setApplyProduct] = useState(null);
  const [closedProjectIds, setClosedProjectIds] = useState([]);
  const [form, setForm] = useState({
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    bank_account_name: "",
    bank_account_number: "",
    bank_ifsc: "",
    bank_name: ""
  });
  const isFocusedProjectView = Boolean(projectIdFromQuery);

  const loadProjects = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const filters = {
        q: query.trim() || undefined
      };

      if (!projectIdFromQuery) {
        filters.mode = mode;
      }

      const res = await getActiveCatalog(filters);
      setProjects(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load active projects.");
    } finally {
      setLoading(false);
    }
  }, [mode, projectIdFromQuery, query]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const loadParticipantStatus = useCallback(async () => {
    try {
      const applicationsRes = await getMyApplications();
      setMyApplications(Array.isArray(applicationsRes?.data?.data) ? applicationsRes.data.data : []);
    } catch {
      setMyApplications([]);
    }

    try {
      const paymentRes = await getPaymentDetails();
      setHasPaymentDetails(Boolean(paymentRes?.data?.data?.hasPaymentDetails));
    } catch {
      setHasPaymentDetails(false);
    }
  }, []);

  useEffect(() => {
    loadParticipantStatus();
  }, [loadParticipantStatus]);

  const openProject = useCallback(async (project) => {
    setError("");
    setNotice("");
    setProducts([]);
    setSelectedProject(project);
    setProductsLoading(true);

    try {
      const accessRes = await requestProjectAccess(project.id);
      const status = accessRes?.data?.data?.status || project.access_status;

      if (String(status).toUpperCase() !== "APPROVED") {
        setNotice("Access request sent. Please wait for admin approval to unlock product details.");
        setSelectedProject({ ...project, access_status: status || "PENDING" });
        return;
      }

      let detailedProject = project;
      try {
        const detailRes = await getProjectById(project.id);
        if (detailRes?.data?.data) {
          detailedProject = { ...project, ...detailRes.data.data };
          setSelectedProject((prev) => ({ ...(prev || {}), ...detailedProject, access_status: "APPROVED" }));
        }
      } catch {
        // Keep lightweight project payload if detail endpoint fails.
      }

      const productsRes = await getProjectProducts(project.id);
      const rows = Array.isArray(productsRes.data?.data?.products)
        ? productsRes.data.data.products
        : [];

      setProducts(rows);
      setSelectedProject((prev) => ({ ...(prev || {}), ...detailedProject, access_status: "APPROVED" }));
      setNotice(rows.length ? "" : "No unlocked products available.");
    } catch (err) {
      const message = err.response?.data?.message || "Unable to open this project.";
      setError(message);
      if (/pending admin approval|locked/i.test(message)) {
        setNotice(message);
      }
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!projectIdFromQuery || !projects.length || selectedProject?.id === projectIdFromQuery) {
      return;
    }

    const match = projects.find((project) => project.id === projectIdFromQuery);
    if (match) {
      openProject(match);
      if (String(match.mode || "").toUpperCase() === "D2C") {
        setMode("D2C");
      } else if (String(match.mode || "").toUpperCase() === "MARKETPLACE") {
        setMode("MARKETPLACE");
      }
    }
  }, [openProject, projectIdFromQuery, projects, selectedProject?.id]);

  useEffect(() => {
    if (!projectIdFromQuery || selectedProject?.id === projectIdFromQuery || loading) {
      return;
    }

    const match = projects.find((project) => project.id === projectIdFromQuery);
    if (match) return;

    const loadDirectProject = async () => {
      try {
        const detailRes = await getProjectById(projectIdFromQuery);
        const project = detailRes?.data?.data;
        if (project?.id) {
          openProject(project);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Selected project not found or not available right now.");
      }
    };

    loadDirectProject();
  }, [loading, openProject, projectIdFromQuery, projects, selectedProject?.id]);

  const visibleProjects = useMemo(() => {
    if (!query.trim()) return projects;
    const term = query.trim().toLowerCase();
    return projects.filter((item) => {
      const title = String(item?.title || "").toLowerCase();
      const category = String(item?.category || "").toLowerCase();
      return title.includes(term) || category.includes(term);
    });
  }, [projects, query]);

  const isSelectedProjectActive = useMemo(() => {
    if (!selectedProject) return true;
    if (closedProjectIds.includes(selectedProject.id)) return false;
    const status = String(selectedProject?.status || "").toUpperCase();
    if (status && status !== "PUBLISHED" && status !== "ACTIVE") {
      return false;
    }

    const now = new Date();
    const start = selectedProject?.start_date ? new Date(selectedProject.start_date) : null;
    const end = selectedProject?.end_date ? new Date(selectedProject.end_date) : null;

    if (start && !Number.isNaN(start.getTime()) && now < start) return false;
    if (end && !Number.isNaN(end.getTime()) && now > end) return false;
    return true;
  }, [closedProjectIds, selectedProject]);

  const submitApplication = async (product, includeDetails = false) => {
    if (!selectedProject?.id || !product?.id) return;
    if (!isSelectedProjectActive) {
      setError("This project is not active right now. You can apply only during the project active dates.");
      return;
    }

    if (includeDetails) {
      const requiredAddress = ["address_line1", "city", "state", "pincode"];
      const requiredBank = ["bank_account_number", "bank_ifsc"];
      const missingRequired = [...requiredAddress, ...requiredBank].some(
        (field) => !String(form[field] || "").trim()
      );

      if (missingRequired) {
        setError("Address line 1, city, state, pincode, bank account number, and IFSC are required.");
        return;
      }
    }

    setError("");
    setNotice("");
    setApplyingProductId(product.id);
    try {
      const payload = { productId: product.id };
      if (includeDetails) {
        payload.address = {
          address_line1: form.address_line1,
          address_line2: form.address_line2,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          country: form.country || "India"
        };
        payload.bankDetails = {
          bank_account_name: form.bank_account_name,
          bank_account_number: form.bank_account_number,
          bank_ifsc: form.bank_ifsc,
          bank_name: form.bank_name
        };
      }

      await applyForProject(selectedProject.id, payload);
      setNotice("Request submitted successfully. Our admin team will review your request and update you by email soon.");
      setApplyProduct(null);
      if (includeDetails) {
        setHasPaymentDetails(true);
      }
      await loadParticipantStatus();
    } catch (err) {
      const message = err.response?.data?.message || "Unable to submit product application.";
      if (err.response?.status === 403) {
        setError("Project access is not approved yet. Request unlock and wait for admin approval.");
      } else if (err.response?.status === 400) {
        if (/already applied/i.test(message)) {
          setNotice("You already requested this product. It is waiting for admin approval.");
          setApplyProduct(null);
          await loadParticipantStatus();
        } else if (/project is not active/i.test(message)) {
          setError("This project is not active right now. Application request cannot be created.");
          if (selectedProject?.id) {
            setClosedProjectIds((prev) => (prev.includes(selectedProject.id) ? prev : [...prev, selectedProject.id]));
          }
          setApplyProduct(null);
        } else {
          setError(message);
        }
      } else {
        setError(message);
      }
    } finally {
      setApplyingProductId("");
    }
  };

  const findApplication = (product) =>
    myApplications.find((item) => {
      const appProjectId = item?.project_id || item?.projects?.id;
      const appProductId = item?.product_id || item?.project_products?.id;
      return appProjectId === selectedProject?.id && appProductId === product?.id;
    });

  return (
    <div className="participant-marketplace-page">
      <header className="participant-marketplace-head">
        <div>
          <h1>Marketplace</h1>
        </div>
        <button
          type="button"
          className="participant-marketplace-back"
          onClick={() => navigate(`/participant/${id}/dashboard`)}
        >
          Back to Dashboard
        </button>
      </header>

      {!isFocusedProjectView ? (
        <section className="participant-marketplace-filters">
          <div className="participant-marketplace-modes">
            <button type="button" className={mode === "MARKETPLACE" ? "active" : ""} onClick={() => setMode("MARKETPLACE")}>
              Marketplace
            </button>
            <button type="button" className={mode === "D2C" ? "active" : ""} onClick={() => setMode("D2C")}>
              D2C
            </button>
          </div>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${mode} projects...`}
          />
        </section>
      ) : null}
      {error ? <p className="participant-marketplace-error">{error}</p> : null}
      {notice ? <p className="participant-marketplace-success">{notice}</p> : null}
      {loading ? <p className="participant-marketplace-loading">Loading projects...</p> : null}

      {!isFocusedProjectView ? (
        <section className="participant-marketplace-grid">
          {visibleProjects.map((project) => {
            const title = project?.title || "Untitled Project";
            const accessStatus = String(project?.access_status || "LOCKED").toUpperCase();
            return (
              <article key={project.id} className="participant-marketplace-card">
                <span className={`participant-marketplace-tag ${String(project.mode || mode).toLowerCase()}`}>
                  {String(project.mode || mode).toUpperCase()}
                </span>
                <h3>{title}</h3>
                <p>Project details are hidden until admin approves access.</p>
                <div className="participant-marketplace-meta">
                  <span>{project?.category || "General"}</span>
                  <strong>{accessStatus === "APPROVED" ? "Unlocked" : accessStatus}</strong>
                </div>
                <button type="button" onClick={() => openProject(project)}>
                  {accessStatus === "APPROVED" ? "View Products" : "Request Access"}
                </button>
              </article>
            );
          })}
          {!loading && !visibleProjects.length ? (
            <div className="participant-marketplace-empty">No active projects found.</div>
          ) : null}
        </section>
      ) : null}

      {isFocusedProjectView && !loading && !selectedProject ? (
        <div className="participant-marketplace-empty">
          Selected project not found or not available right now.
        </div>
      ) : null}

      {selectedProject ? (
        <section className="participant-marketplace-products" style={{ marginTop: 24 }}>
          <h2>{selectedProject.title || "Selected Project"} Product List</h2>
          <div className="participant-project-details">
            <div className="participant-project-details-grid">
              <div className="participant-project-detail-item">
                <span>Category</span>
                <strong>{selectedProject?.category || "-"}</strong>
              </div>
              <div className="participant-project-detail-item">
                <span>Mode</span>
                <strong>{String(selectedProject?.mode || "-").toUpperCase()}</strong>
              </div>
              <div className="participant-project-detail-item">
                <span>Status</span>
                <strong>{String(selectedProject?.status || "ACTIVE").toUpperCase()}</strong>
              </div>
              <div className="participant-project-detail-item">
                <span>Reward</span>
                <strong>{formatCurrency(selectedProject?.reward || 0)}</strong>
              </div>
              <div className="participant-project-detail-item">
                <span>Total Units</span>
                <strong>{formatNumber(selectedProject?.total_units)}</strong>
              </div>
              <div className="participant-project-detail-item">
                <span>Start Date</span>
                <strong>{formatDate(selectedProject?.start_date)}</strong>
              </div>
              <div className="participant-project-detail-item">
                <span>End Date</span>
                <strong>{formatDate(selectedProject?.end_date)}</strong>
              </div>
              <div className="participant-project-detail-item">
                <span>Created By</span>
                <strong>{selectedProject?.created_by_name || "-"}</strong>
              </div>
              <div className="participant-project-detail-item">
                <span>Primary URL</span>
                <strong>
                  {selectedProject?.product_url ? (
                    <a href={selectedProject.product_url} target="_blank" rel="noreferrer">Open Link</a>
                  ) : (
                    "-"
                  )}
                </strong>
              </div>
            </div>
            <div className="participant-project-details-full">
              <span>Description</span>
              <p>{selectedProject?.description || "-"}</p>
            </div>
          </div>
          <p className="participant-marketplace-loading" style={{ marginTop: 6 }}>
            Product links are available after admin unlocks this project.
          </p>
          {productsLoading ? <p className="participant-marketplace-loading">Loading products...</p> : null}
          {!productsLoading && !products.length ? (
            <div className="participant-marketplace-empty">No products available or all products already applied.</div>
          ) : null}

          {!productsLoading && products.length ? (
            <div className="participant-products-table-wrap">
              <table className="participant-products-table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Product URL</th>
                    <th>Mode</th>
                    <th>Price (INR)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>
                        {product?.product_url ? (
                          <a href={product.product_url} target="_blank" rel="noreferrer">
                            Open Product URL
                          </a>
                        ) : (
                          <span className="participant-link-locked">URL not available</span>
                        )}
                      </td>
                      <td>{String(selectedProject.mode || "").toUpperCase()}</td>
                      <td>{formatCurrency(product.price || product.product_value || 0)}</td>
                      <td>
                        {(() => {
                          const match = findApplication(product);
                          const status = String(match?.status || "").toUpperCase();

                          if (!match) {
                            return (
                              <button
                                type="button"
                                className="participant-products-apply-btn"
                                onClick={() => {
                                  setError("");
                                  setNotice("");
                                  if (hasPaymentDetails) {
                                    submitApplication(product, false);
                                    return;
                                  }
                                  setApplyProduct(product);
                                }}
                                disabled={applyingProductId === product.id || !isSelectedProjectActive}
                              >
                                {applyingProductId === product.id
                                  ? "Submitting..."
                                  : !isSelectedProjectActive
                                    ? "Project Closed"
                                    : hasPaymentDetails
                                      ? "Send Request"
                                      : "Apply"}
                              </button>
                            );
                          }

                          if (status === "PENDING") {
                            return <span className="participant-pill participant-pill-pending">Pending Approval</span>;
                          }

                          if (status === "APPROVED") {
                            if (product?.product_url) {
                              return (
                                <a className="participant-products-buy-btn" href={product.product_url} target="_blank" rel="noreferrer">
                                  Buy Now
                                </a>
                              );
                            }
                            return <span className="participant-pill participant-pill-approved">Approved</span>;
                          }

                          if (status === "REJECTED") {
                            return <span className="participant-pill participant-pill-rejected">Rejected</span>;
                          }

                          return <span className="participant-link-locked">{status || "Applied"}</span>;
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {applyProduct ? (
        <div className="participant-modal-overlay" role="presentation" onClick={() => setApplyProduct(null)}>
          <section className="participant-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Apply for {applyProduct.name}</h3>
            <p>Fill address and bank details to submit your request to admin.</p>
            <div className="participant-modal-grid">
              <input placeholder="Address line 1*" value={form.address_line1} onChange={(e) => setForm((prev) => ({ ...prev, address_line1: e.target.value }))} />
              <input placeholder="Address line 2" value={form.address_line2} onChange={(e) => setForm((prev) => ({ ...prev, address_line2: e.target.value }))} />
              <input placeholder="City*" value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
              <input placeholder="State*" value={form.state} onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))} />
              <input placeholder="Pincode*" value={form.pincode} onChange={(e) => setForm((prev) => ({ ...prev, pincode: e.target.value }))} />
              <input placeholder="Country" value={form.country} onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))} />
              <input placeholder="Account holder name" value={form.bank_account_name} onChange={(e) => setForm((prev) => ({ ...prev, bank_account_name: e.target.value }))} />
              <input placeholder="Bank account number*" value={form.bank_account_number} onChange={(e) => setForm((prev) => ({ ...prev, bank_account_number: e.target.value }))} />
              <input placeholder="IFSC code*" value={form.bank_ifsc} onChange={(e) => setForm((prev) => ({ ...prev, bank_ifsc: e.target.value }))} />
              <input placeholder="Bank name" value={form.bank_name} onChange={(e) => setForm((prev) => ({ ...prev, bank_name: e.target.value }))} />
            </div>
            <div className="participant-modal-actions">
              <button type="button" className="participant-products-apply-btn" onClick={() => submitApplication(applyProduct, true)} disabled={applyingProductId === applyProduct.id}>
                {applyingProductId === applyProduct.id ? "Submitting..." : "Submit Request"}
              </button>
              <button type="button" className="participant-modal-cancel" onClick={() => setApplyProduct(null)}>Cancel</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default Marketplace;
