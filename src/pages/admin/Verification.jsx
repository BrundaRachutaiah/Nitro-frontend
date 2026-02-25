import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProofReview from "../../components/verification/ProofPreview";
import ApproveRejectionButton from "../../components/verification/ApproveRejectButtons";
import axios from "../../api/axiosInstance";
import "../superAdmin/AdminPages.css";

const VALID_UPLOAD_TYPES = new Set(["ALL", "INVOICE", "REVIEW"]);
const VALID_STATUSES = new Set(["ALL", "PENDING", "APPROVED", "REJECTED"]);

const readQueryFilters = (search) => {
  const params = new URLSearchParams(search);
  const uploadType = String(params.get("uploadType") || "ALL").toUpperCase();
  const status = String(params.get("status") || "ALL").toUpperCase();
  return {
    uploadType: VALID_UPLOAD_TYPES.has(uploadType) ? uploadType : "ALL",
    status: VALID_STATUSES.has(status) ? status : "ALL"
  };
};

const Verifications = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialFilters = readQueryFilters(location.search);

  const [proofs, setProofs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploadTypeFilter, setUploadTypeFilter] = useState(initialFilters.uploadType);
  const [statusFilter, setStatusFilter] = useState(initialFilters.status);
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");
  const [processingReviewId, setProcessingReviewId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const shouldFetchProofs = uploadTypeFilter !== "REVIEW";
      const shouldFetchReviews = uploadTypeFilter !== "INVOICE";

      const proofPath = statusFilter === "PENDING"
        ? "/admin/purchase-proofs/pending"
        : statusFilter === "ALL"
          ? "/admin/purchase-proofs?limit=200"
          : `/admin/purchase-proofs?status=${statusFilter}&limit=200`;

      const reviewPath = statusFilter === "PENDING"
        ? "/admin/reviews/pending"
        : statusFilter === "ALL"
          ? "/admin/reviews?limit=200"
          : `/admin/reviews?status=${statusFilter}&limit=200`;

      const [proofRes, reviewRes] = await Promise.all([
        shouldFetchProofs ? axios.get(proofPath) : Promise.resolve({ data: { data: [] } }),
        shouldFetchReviews ? axios.get(reviewPath) : Promise.resolve({ data: { data: [] } })
      ]);

      setProofs(Array.isArray(proofRes.data?.data) ? proofRes.data.data : []);
      setReviews(Array.isArray(reviewRes.data?.data) ? reviewRes.data.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load verifications.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, uploadTypeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const next = readQueryFilters(location.search);
    setUploadTypeFilter(next.uploadType);
    setStatusFilter(next.status);
  }, [location.search]);

  const updateReviewStatus = async (id, action) => {
    if (processingReviewId === id) return;
    setError("");
    setProcessingReviewId(id);
    try {
      await axios.patch(`/admin/reviews/${id}/${action}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} review`);
    } finally {
      setProcessingReviewId(null);
    }
  };

  const showInvoiceTable = uploadTypeFilter === "ALL" || uploadTypeFilter === "INVOICE";
  const showReviewTable = uploadTypeFilter === "ALL" || uploadTypeFilter === "REVIEW";
  const showActionsColumn = statusFilter === "PENDING";

  const rowsForFilters = useMemo(() => {
    const rows = [];
    if (showInvoiceTable) rows.push(...proofs);
    if (showReviewTable) rows.push(...reviews);
    return rows;
  }, [showInvoiceTable, showReviewTable, proofs, reviews]);

  const projectOptions = useMemo(() => {
    const map = new Map();
    for (const row of rowsForFilters) {
      const id = row.project_id;
      if (!id || map.has(id)) continue;
      map.set(id, row.project_name || row.project_title || id);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rowsForFilters]);

  const productOptions = useMemo(() => {
    const map = new Map();
    const base = rowsForFilters.filter((row) => (
      projectFilter === "ALL" || row.project_id === projectFilter
    ));
    for (const row of base) {
      const id = row.product_id;
      if (!id || map.has(id)) continue;
      map.set(id, row.product_name || id);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rowsForFilters, projectFilter]);

  useEffect(() => {
    setProductFilter("ALL");
  }, [projectFilter]);

  const filteredProofs = useMemo(
    () => proofs.filter((row) => {
      const projectMatch = projectFilter === "ALL" || row.project_id === projectFilter;
      const productMatch = productFilter === "ALL" || row.product_id === productFilter;
      return projectMatch && productMatch;
    }),
    [proofs, projectFilter, productFilter]
  );

  const filteredReviews = useMemo(
    () => reviews.filter((row) => {
      const projectMatch = projectFilter === "ALL" || row.project_id === projectFilter;
      const productMatch = productFilter === "ALL" || row.product_id === productFilter;
      return projectMatch && productMatch;
    }),
    [reviews, projectFilter, productFilter]
  );

  const pageTitle = useMemo(() => {
    if (uploadTypeFilter === "INVOICE") return "Invoice Upload Verifications";
    if (uploadTypeFilter === "REVIEW") return "Review Upload Verifications";
    return "Verifications";
  }, [uploadTypeFilter]);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>{pageTitle}</h1>
          <p>Review and approve participant uploads</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="admin-btn" onClick={() => navigate("/admin/applications")}>Back</button>
          <button type="button" className="admin-btn" onClick={load}>Refresh</button>
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-panel mb-3">
        <h3 className="mb-2">Upload Filters</h3>
        <div className="admin-actions" style={{ gap: 10 }}>
          <label htmlFor="upload-status-filter">Status</label>
          <select
            id="upload-status-filter"
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

          <label htmlFor="project-filter">Project</label>
          <select
            id="project-filter"
            className="form-select"
            style={{ maxWidth: 280 }}
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="ALL">All Projects</option>
            {projectOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <label htmlFor="product-filter">Product</label>
          <select
            id="product-filter"
            className="form-select"
            style={{ maxWidth: 280 }}
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
          >
            <option value="ALL">All Products</option>
            {productOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {showInvoiceTable ? (
        <section className="admin-panel admin-table-wrap">
          <h3 className="mb-3">Invoice Uploads</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Product</th>
                <th>Participant Name</th>
                <th>Participant Email</th>
                <th>Proof</th>
                <th>Status</th>
                <th>Uploaded</th>
                {showActionsColumn ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={showActionsColumn ? 8 : 7}>Loading invoice uploads...</td></tr>
              ) : filteredProofs.length ? (
                filteredProofs.map((p) => (
                  <tr key={p.id}>
                    <td>{p.project_name || "-"}</td>
                    <td>{p.product_name || "-"}</td>
                    <td>{p.participant_name || "-"}</td>
                    <td>{p.participant_email || "-"}</td>
                    <td><ProofReview proofUrl={p.file_url} /></td>
                    <td><span className={`admin-badge ${String(p.status || "").toLowerCase()}`}>{p.status || "-"}</span></td>
                    <td>{(p.uploaded_at || p.created_at) ? new Date(p.uploaded_at || p.created_at).toLocaleString() : "-"}</td>
                    {showActionsColumn ? (
                      <td>
                        {String(p?.status || "").toUpperCase() === "PENDING"
                          ? <ApproveRejectionButton id={p.id} onDone={load} />
                          : "-"}
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr><td className="admin-empty" colSpan={showActionsColumn ? 8 : 7}>No invoice uploads for selected filter.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      ) : null}

      {showReviewTable ? (
        <section className="admin-panel admin-table-wrap mt-3">
          <h3 className="mb-3">Review Uploads</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Product</th>
                <th>Participant Name</th>
                <th>Participant Email</th>
                <th>Review Link</th>
                <th>Review Text</th>
                <th>Status</th>
                <th>Submitted</th>
                {showActionsColumn ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={showActionsColumn ? 9 : 8}>Loading review uploads...</td></tr>
              ) : filteredReviews.length ? (
                filteredReviews.map((review) => (
                  <tr key={review.id}>
                    <td>{review.project_name || "-"}</td>
                    <td>{review.product_name || "-"}</td>
                    <td>{review.participant_name || "-"}</td>
                    <td>{review.participant_email || "-"}</td>
                    <td>
                      {review.review_url ? (
                        <a href={review.review_url} target="_blank" rel="noreferrer">View Upload</a>
                      ) : "-"}
                    </td>
                    <td>{review.review_text || "-"}</td>
                    <td><span className={`admin-badge ${String(review.status || "").toLowerCase()}`}>{review.status || "-"}</span></td>
                    <td>{review.created_at ? new Date(review.created_at).toLocaleString() : "-"}</td>
                    {showActionsColumn ? (
                      <td>
                        {String(review?.status || "").toUpperCase() === "PENDING" ? (
                          <div className="admin-actions">
                            <button
                              type="button"
                              className="admin-btn"
                              disabled={processingReviewId === review.id}
                              onClick={() => updateReviewStatus(review.id, "approve")}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="admin-btn"
                              disabled={processingReviewId === review.id}
                              onClick={() => updateReviewStatus(review.id, "reject")}
                            >
                              Reject
                            </button>
                          </div>
                        ) : "-"}
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr><td className="admin-empty" colSpan={showActionsColumn ? 9 : 8}>No review uploads for selected filter.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
};

export default Verifications;
