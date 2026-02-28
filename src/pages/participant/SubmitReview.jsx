import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getMyAllocationTracking } from "../../api/allocation.api";
import { submitFeedback, submitReview, uploadReviewProofs } from "../../api/participant.api";
import "./ActionForms.css";
import "./SubmitReview.css";

const SubmitReview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id, allocationId: routeAllocationId } = useParams();
  const [allocationId, setAllocationId] = useState("");
  const [productId, setProductId] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [reviewFiles, setReviewFiles] = useState([]);
  const [rating, setRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [allocations, setAllocations] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const routeProductId = useMemo(() => new URLSearchParams(location.search).get("product") || "", [location.search]);
  const participantDashboardPath = id ? `/participant/${id}/dashboard` : "/dashboard";
  const participantTasksPath = id ? `/participant/${id}/allocation/active` : "/dashboard";
  const participantPayoutPath = id ? `/participant/${id}/payouts` : "/dashboard";
  const isRejected = (submission) => String(submission?.status || "").toUpperCase() === "REJECTED";
  const getProofStatus = (proof) => String(proof?.status || "").toUpperCase();
  const isProofSubmitted = (proof) => {
    if (!proof) return false;
    const status = getProofStatus(proof);
    if (!status) return true;
    return status !== "REJECTED";
  };
  const isProofApproved = (proof) => getProofStatus(proof) === "APPROVED";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getMyAllocationTracking({ timeout: 15000 });
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        const candidates = rows.filter((row) => {
          const mode = String(row?.projects?.mode || "").toUpperCase();
          const products = Array.isArray(row?.selected_products) ? row.selected_products : [];
          if (products.length) {
            const anyProductPending = products.some((product) => {
              const proofSubmitted = isProofSubmitted(product?.purchase_proof);
              const proofApproved = isProofApproved(product?.purchase_proof);
              const hasValidReview = Boolean(product?.review_submission) && !isRejected(product?.review_submission);
              const needsReview = proofSubmitted && !hasValidReview;
              const needsFeedback = mode === "MARKETPLACE" && proofSubmitted && hasValidReview && !product?.feedback_submission;
              return needsReview || needsFeedback;
            });
            if (anyProductPending) return true;

            // Compatibility fallback for old allocation-level proof/review data.
            const proofSubmitted = isProofSubmitted(row?.purchase_proof);
            const proofApproved = isProofApproved(row?.purchase_proof);
            const hasValidReview = Boolean(row?.review_submission) && !isRejected(row?.review_submission);
            const needsReview = proofSubmitted && !hasValidReview;
            const needsFeedback = mode === "MARKETPLACE" && proofSubmitted && hasValidReview && !row?.feedback_submission;
            return needsReview || needsFeedback;
          }

          const proofSubmitted = isProofSubmitted(row?.purchase_proof);
          const proofApproved = isProofApproved(row?.purchase_proof);
          const hasValidReview = Boolean(row?.review_submission) && !isRejected(row?.review_submission);
          const needsReview = proofSubmitted && !hasValidReview;
          const needsFeedback = mode === "MARKETPLACE" && proofSubmitted && hasValidReview && !row?.feedback_submission;
          return needsReview || needsFeedback;
        });
        setAllocations(candidates);
        if (candidates.length) {
          const fromRoute = routeAllocationId && candidates.some((row) => row.id === routeAllocationId)
            ? routeAllocationId
            : candidates[0].id;
          setAllocationId(fromRoute);
        }
      } catch (err) {
        const timeout = err?.code === "ECONNABORTED";
        setError(
          timeout
            ? "Loading timed out. Please retry."
            : (err.response?.data?.message || "Unable to load tasks.")
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [routeAllocationId, reloadKey]);

  const selectedAllocation = useMemo(
    () => allocations.find((row) => row.id === allocationId) || null,
    [allocations, allocationId]
  );
  const pendingProducts = useMemo(() => {
    const mode = String(selectedAllocation?.projects?.mode || "").toUpperCase();
    const products = Array.isArray(selectedAllocation?.selected_products)
      ? selectedAllocation.selected_products
      : [];
    if (!products.length) return [];
    const pending = products.filter((product) => {
      const proofSubmitted = isProofSubmitted(product?.purchase_proof);
      const proofApproved = isProofApproved(product?.purchase_proof);
      const hasValidReview = Boolean(product?.review_submission) && !isRejected(product?.review_submission);
      const needsReviewForProduct = proofSubmitted && !hasValidReview;
      const needsFeedbackForProduct = mode === "MARKETPLACE" && proofSubmitted && hasValidReview && !product?.feedback_submission;
      return needsReviewForProduct || needsFeedbackForProduct;
    });
    if (pending.length) return pending;

    // Compatibility fallback when proof/review is still at allocation-level.
    if (products.length === 1) {
      const proofSubmitted = isProofSubmitted(selectedAllocation?.purchase_proof);
      const proofApproved = isProofApproved(selectedAllocation?.purchase_proof);
      const hasValidReview = Boolean(selectedAllocation?.review_submission) && !isRejected(selectedAllocation?.review_submission);
      const needsReview = (mode === "MARKETPLACE" || mode === "D2C") && proofSubmitted && !hasValidReview;
      const needsFeedback = mode === "MARKETPLACE" && proofApproved && hasValidReview && !selectedAllocation?.feedback_submission;
      if (needsReview || needsFeedback) return products;
    }
    return [];
  }, [selectedAllocation]);

  useEffect(() => {
    if (!pendingProducts.length) {
      setProductId("");
      return;
    }
    const preferred = routeProductId && pendingProducts.some((product) => product.product_id === routeProductId)
      ? routeProductId
      : productId;
    const next = pendingProducts.some((product) => product.product_id === preferred)
      ? preferred
      : pendingProducts[0].product_id;
    setProductId(next || "");
  }, [pendingProducts, productId, routeProductId]);

  const selectedProduct = useMemo(() => {
    if (!pendingProducts.length) return null;
    return pendingProducts.find((product) => product.product_id === productId) || pendingProducts[0] || null;
  }, [pendingProducts, productId]);

  const selectedMode = String(selectedAllocation?.projects?.mode || "").toUpperCase();
  const fallbackHasValidReview = Boolean(selectedAllocation?.review_submission) && !isRejected(selectedAllocation?.review_submission);
  const fallbackNeedsReview = Boolean(selectedAllocation) && !fallbackHasValidReview;
  const fallbackNeedsFeedback = selectedMode === "MARKETPLACE" && fallbackHasValidReview && !selectedAllocation?.feedback_submission;
  const needsReview = selectedProduct
    ? !(Boolean(selectedProduct?.review_submission) && !isRejected(selectedProduct?.review_submission))
    : fallbackNeedsReview;
  const needsFeedback = selectedProduct
    ? selectedMode === "MARKETPLACE" && Boolean(selectedProduct?.review_submission) && !isRejected(selectedProduct?.review_submission) && !selectedProduct?.feedback_submission
    : fallbackNeedsFeedback;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!allocationId) {
      setError("Please select a task.");
      return;
    }
    if (pendingProducts.length && !productId) {
      setError("Please select a product.");
      return;
    }

    if (!needsReview && !needsFeedback) {
      setError("Selected task is already completed.");
      return;
    }

    try {
      setSubmitting(true);
      if (needsReview) {
        if (selectedMode === "MARKETPLACE" && reviewFiles.length === 0 && !reviewUrl.trim()) {
          setError("Please upload a review screenshot or provide a review URL.");
          setSubmitting(false);
          return;
        }

        if (selectedMode === "D2C" && !reviewText.trim() && reviewFiles.length === 0 && !reviewUrl.trim()) {
          setError("Please add review text and/or screenshot.");
          setSubmitting(false);
          return;
        }

        const manualReviewUrl = reviewUrl.trim();
        let finalReviewUrl = manualReviewUrl;
        let finalReviewText = reviewText.trim();
        let uploadedUrls = [];

        if (reviewFiles.length > 0) {
          const formData = new FormData();
          reviewFiles.forEach((file) => {
            formData.append("files", file);
          });
          const uploadRes = await uploadReviewProofs(allocationId, formData, productId);
          uploadedUrls = Array.isArray(uploadRes?.data?.data?.review_urls)
            ? uploadRes.data.data.review_urls
            : [];
        }

        if (uploadedUrls.length > 0) {
          finalReviewUrl = uploadedUrls[0];
        }

        if (uploadedUrls.length > 1 || manualReviewUrl) {
          const extraLinks = [
            ...uploadedUrls.slice(1),
            ...(manualReviewUrl ? [manualReviewUrl] : [])
          ];

          if (extraLinks.length > 0) {
            const extraText = `Additional review image links:\n${extraLinks.join("\n")}`;
            finalReviewText = finalReviewText
              ? `${finalReviewText}\n\n${extraText}`
              : extraText;
          }
        }

        await submitReview({
          allocationId,
          productId: productId || undefined,
          reviewText: finalReviewText,
          reviewUrl: finalReviewUrl
        });

        // Mark this product's review as submitted in local state so the UI advances to next product
        setAllocations((prev) => prev.map((row) => {
          if (row.id !== allocationId) return row;
          const updatedProducts = (Array.isArray(row.selected_products) ? row.selected_products : []).map((product) =>
            String(product?.product_id || "") === String(productId || "")
              ? { ...product, review_submission: { ...(product?.review_submission || {}), status: "PENDING", created_at: new Date().toISOString() } }
              : product
          );
          // Also mark allocation-level review for single-product fallback
          const updatedAlloc = updatedProducts.length === 1 && !productId
            ? { ...row, review_submission: { status: "PENDING", created_at: new Date().toISOString() }, selected_products: updatedProducts }
            : { ...row, selected_products: updatedProducts };
          return updatedAlloc;
        }));

        // Count remaining products that still need a review
        const remainingProducts = pendingProducts.filter(
          (product) => String(product?.product_id || "") !== String(productId || "")
        );
        setMessage(
          remainingProducts.length
            ? `✅ Review submitted for this product! Next: submit review for "${remainingProducts[0]?.product_name || "the next product"}".`
            : "🎉 All reviews submitted! Awaiting admin approval."
        );
      } else if (needsFeedback) {
        if (!feedbackText.trim()) {
          setError("Please add your feedback.");
          setSubmitting(false);
          return;
        }

        await submitFeedback({
          allocationId,
          productId: productId || undefined,
          rating: Number(rating),
          feedbackText: feedbackText.trim()
        });

        // Mark this product's feedback as submitted in local state
        setAllocations((prev) => prev.map((row) => {
          if (row.id !== allocationId) return row;
          const updatedProducts = (Array.isArray(row.selected_products) ? row.selected_products : []).map((product) =>
            String(product?.product_id || "") === String(productId || "")
              ? { ...product, feedback_submission: { created_at: new Date().toISOString() } }
              : product
          );
          return { ...row, selected_products: updatedProducts };
        }));

        const remainingFeedback = pendingProducts.filter(
          (product) => String(product?.product_id || "") !== String(productId || "")
        );
        setMessage(
          remainingFeedback.length
            ? `✅ Feedback submitted! Next: submit feedback for "${remainingFeedback[0]?.product_name || "the next product"}".`
            : "🎉 All feedback submitted successfully."
        );
      }

      setReviewFiles([]);
      setReviewText("");
      setReviewUrl("");
      setFeedbackText("");
      setRating(5);
    } catch (err) {
      setError(err.response?.data?.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="participant-review-page">
      <header className="participant-review-topbar">
        <div className="participant-review-brand">Nitro</div>
        <nav>
          <button type="button" onClick={() => navigate(participantDashboardPath)}>Dashboard</button>
          <button type="button" className="active" onClick={() => navigate(participantTasksPath)}>My Tasks</button>
          <button type="button" onClick={() => navigate(participantPayoutPath)}>Payouts</button>
        </nav>
      </header>

      <main className="participant-review-main">
        <header className="participant-action-header">
          <div>
            <h1>Submit Review / Feedback</h1>
            <p>Use this page to complete your pending review or feedback task.</p>
          </div>
          <button type="button" className="participant-action-back" onClick={() => navigate(participantTasksPath)}>
            Back to My Tasks
          </button>
        </header>

        <section className="participant-action-card">
          {error ? <p className="participant-action-error">{error}</p> : null}
          {error ? (
            <button type="button" onClick={() => setReloadKey((prev) => prev + 1)} className="participant-action-back">
              Retry Loading
            </button>
          ) : null}
          {message ? <p className="participant-action-success">{message}</p> : null}
          {loading ? <p className="participant-action-muted">Loading allocations...</p> : null}
          {!loading && !allocations.length ? (
            <p className="participant-action-muted">No review or feedback tasks are pending.</p>
          ) : null}

          {!loading && allocations.length ? (
            <form onSubmit={handleSubmit} className="participant-action-form">
              <label htmlFor="allocationId">Task</label>
              <select id="allocationId" value={allocationId} onChange={(e) => { setAllocationId(e.target.value); setMessage(""); }}>
                {allocations.map((row) => {
                  const title = row?.projects?.title || row?.projects?.name || row.id;
                  return (
                    <option key={row.id} value={row.id}>
                      {title}
                    </option>
                  );
                })}
              </select>

              {/* Product progress checklist — shown when allocation has multiple products */}
              {Array.isArray(selectedAllocation?.selected_products) && selectedAllocation.selected_products.length > 0 ? (() => {
                const allProducts = selectedAllocation.selected_products;
                const submittedCount = allProducts.filter((p) => {
                  const hasReview = Boolean(p?.review_submission) && String(p?.review_submission?.status || "").toUpperCase() !== "REJECTED";
                  const hasFeedback = Boolean(p?.feedback_submission);
                  return hasReview || hasFeedback;
                }).length;
                const totalCount = allProducts.length;
                const pct = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;
                return (
                  <div style={{ margin: "1rem 0", padding: "1rem", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #e9ecef" }}>
                    <div style={{ fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                      📋 Review Progress — {submittedCount} of {totalCount} products done
                    </div>
                    <div style={{ background: "#e9ecef", borderRadius: "4px", height: "8px", marginBottom: "0.75rem" }}>
                      <div style={{ background: "#28a745", borderRadius: "4px", height: "8px", width: `${pct}%`, transition: "width 0.3s" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {allProducts.map((product) => {
                        const hasReview = Boolean(product?.review_submission) && String(product?.review_submission?.status || "").toUpperCase() !== "REJECTED";
                        const hasFeedback = Boolean(product?.feedback_submission);
                        const done = hasReview || hasFeedback;
                        const isCurrent = product.product_id === productId;
                        return (
                          <button
                            key={product.product_id || product.application_id}
                            type="button"
                            disabled={done}
                            onClick={() => { if (!done) { setProductId(product.product_id || ""); setMessage(""); } }}
                            style={{
                              display: "flex", alignItems: "center", gap: "0.5rem",
                              padding: "0.4rem 0.75rem", borderRadius: "6px", border: "1px solid",
                              cursor: done ? "default" : "pointer", textAlign: "left", fontSize: "0.875rem",
                              background: done ? "#d4edda" : isCurrent ? "#cce5ff" : "#fff",
                              borderColor: done ? "#c3e6cb" : isCurrent ? "#b8daff" : "#dee2e6",
                              color: done ? "#155724" : isCurrent ? "#004085" : "#495057"
                            }}
                          >
                            <span>{done ? "✓" : isCurrent ? "●" : "○"}</span>
                            <span style={{ flex: 1 }}>{product.product_name || "Product"}</span>
                            <span style={{
                              fontSize: "0.75rem", padding: "0.1rem 0.5rem", borderRadius: "12px",
                              background: done ? "#28a745" : isCurrent ? "#007bff" : "#6c757d", color: "#fff"
                            }}>
                              {done ? "Done" : isCurrent ? "Current" : "Pending"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })() : null}

              {/* Current product banner */}
              {selectedProduct && pendingProducts.length > 0 ? (
                <div style={{ background: "#e7f3ff", border: "1px solid #b8daff", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "0.5rem" }}>
                  <div style={{ fontSize: "0.8rem", color: "#004085", marginBottom: "0.2rem" }}>
                    {needsReview ? "Submitting review for:" : "Submitting feedback for:"}
                  </div>
                  <div style={{ fontWeight: 600, color: "#004085" }}>{selectedProduct.product_name || "Product"}</div>
                  {pendingProducts.length > 1 ? (
                    <div style={{ fontSize: "0.8rem", color: "#0056b3", marginTop: "0.2rem" }}>
                      {pendingProducts.length} products still need a review
                    </div>
                  ) : null}
                </div>
              ) : null}

              {pendingProducts.length > 1 ? (
                <>
                  <label htmlFor="productId">Select product to review</label>
                  <select id="productId" value={productId} onChange={(e) => { setProductId(e.target.value); setMessage(""); }}>
                    {pendingProducts.map((product) => (
                      <option key={product.product_id || product.application_id} value={product.product_id || ""}>
                        {product.product_name || "Product"}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
              {needsReview ? (
                <>
                  <label htmlFor="reviewFile">Review Screenshot</label>
                  <input
                    id="reviewFile"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setReviewFiles(Array.from(e.target.files || []))}
                  />
                  {reviewFiles.length ? (
                    <p className="participant-action-note">
                      {reviewFiles.length} image(s) selected
                    </p>
                  ) : null}

                  <label htmlFor="reviewUrl">Review Proof URL (Optional)</label>
                  <input
                    id="reviewUrl"
                    type="url"
                    placeholder="https://..."
                    value={reviewUrl}
                    onChange={(e) => setReviewUrl(e.target.value)}
                  />

                  <label htmlFor="reviewText">Review Text</label>
                  <textarea
                    id="reviewText"
                    placeholder="Write your review"
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    rows={5}
                  />
                </>
              ) : null}

              {needsFeedback ? (
                <>
                  <label htmlFor="rating">Rating (1-5)</label>
                  <input
                    id="rating"
                    type="number"
                    min={1}
                    max={5}
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                  />

                  <label htmlFor="feedbackText">Feedback</label>
                  <textarea
                    id="feedbackText"
                    placeholder="Share your feedback"
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    rows={5}
                  />
                </>
              ) : null}

              <button type="submit" disabled={submitting || (!needsReview && !needsFeedback)}>
                {submitting
                  ? "Submitting..."
                  : needsReview
                    ? `Submit Review${selectedProduct ? ` for "${selectedProduct.product_name || "Product"}"` : ""}`
                    : needsFeedback
                      ? `Submit Feedback${selectedProduct ? ` for "${selectedProduct.product_name || "Product"}"` : ""}`
                      : "Completed"}
              </button>

              {/* All-done summary: show when no pending products remain */}
              {!needsReview && !needsFeedback && pendingProducts.length === 0 && selectedAllocation ? (
                <div style={{ marginTop: "1rem", padding: "1rem", background: "#d4edda", border: "1px solid #c3e6cb", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🎉</div>
                  <strong style={{ color: "#155724" }}>All reviews submitted for this task!</strong>
                  <p style={{ color: "#155724", margin: "0.25rem 0 0" }}>Your submissions are awaiting admin approval.</p>
                </div>
              ) : null}
            </form>
          ) : null}
        </section>
      </main>
    </div>
  );
};

export default SubmitReview;