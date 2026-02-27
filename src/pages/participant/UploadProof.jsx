import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMyAllocationTracking } from "../../api/allocation.api";
import { uploadPurchaseProof } from "../../api/verification.api";
import "./ActionForms.css";
import "./UploadProof.css";

const UploadProof = () => {
  const navigate = useNavigate();
  const { id, allocationId: routeAllocationId } = useParams();
  const [file, setFile] = useState(null);
  const [allocationId, setAllocationId] = useState("");
  const [productId, setProductId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const participantDashboardPath = id ? `/participant/${id}/dashboard` : "/dashboard";
  const participantAllocationPath = id ? `/participant/${id}/allocation/active` : "/dashboard";
  const participantPayoutPath = id ? `/participant/${id}/payouts` : "/dashboard";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getMyAllocationTracking();
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        const candidates = rows.filter((row) => {
          const products = Array.isArray(row?.selected_products) ? row.selected_products : [];
          if (!products.length) return !row?.purchase_proof;
          return products.some((product) => !product?.purchase_proof);
        });
        setAllocations(candidates);
        if (candidates.length) {
          const fromRoute = routeAllocationId && candidates.some((row) => row.id === routeAllocationId)
            ? routeAllocationId
            : candidates[0].id;
          setAllocationId(fromRoute);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load tasks.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [routeAllocationId]);

  const selectedAllocation = useMemo(
    () => allocations.find((row) => row.id === allocationId) || null,
    [allocations, allocationId]
  );
  const allocationProducts = useMemo(() => {
    const products = Array.isArray(selectedAllocation?.selected_products)
      ? selectedAllocation.selected_products
      : [];
    return products;
  }, [selectedAllocation]);
  const pendingProducts = useMemo(() => {
    if (!allocationProducts.length) return [];
    return allocationProducts.filter((product) => !product?.purchase_proof);
  }, [allocationProducts]);
  const doneProducts = useMemo(() => {
    if (!allocationProducts.length) return [];
    return allocationProducts.filter((product) => Boolean(product?.purchase_proof));
  }, [allocationProducts]);
  const selectedProduct = useMemo(() => {
    if (!allocationProducts.length) return null;
    return allocationProducts.find((product) => product.product_id === productId) || null;
  }, [allocationProducts, productId]);
  const totalProducts = allocationProducts.length;
  const uploadedInvoiceCount = doneProducts.length;
  const remainingInvoiceCount = Math.max(0, totalProducts - uploadedInvoiceCount);
  const progressPct = totalProducts > 0 ? Math.round((uploadedInvoiceCount / totalProducts) * 100) : 0;

  // Only auto-select productId when pendingProducts list changes (e.g. after a successful upload),
  // NOT on every productId change — so the user can freely switch products in the dropdown.
  useEffect(() => {
    if (pendingProducts.length) {
      // If current productId is still valid (still pending), keep it; otherwise pick the first pending
      setProductId((prev) => {
        const stillPending = pendingProducts.some((product) => product.product_id === prev);
        return stillPending ? prev : (pendingProducts[0].product_id || "");
      });
      return;
    }
    setProductId("");
  }, [pendingProducts]);

  const handleFileChange = (f) => {
    if (f) { setFile(f); setError(""); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!allocationId || !file) {
      setError("Please choose a file to upload.");
      return;
    }
    if (pendingProducts.length && !productId) {
      setError("Please select a product.");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
      await uploadPurchaseProof(allocationId, formData, productId);
      setAllocations((prev) => prev.map((row) => {
        if (row.id !== allocationId) return row;
        const selectedProducts = Array.isArray(row?.selected_products) ? row.selected_products : [];
        const updatedProducts = selectedProducts.map((product) => (
          String(product?.product_id || "") === String(productId || "")
            ? { ...product, purchase_proof: { ...(product?.purchase_proof || {}), status: "PENDING", created_at: new Date().toISOString() } }
            : product
        ));
        return { ...row, selected_products: updatedProducts };
      }));
      const remainingPending = pendingProducts.filter((product) => (
        String(product?.product_id || "") !== String(productId || "")
      ));
      const nextProductName = remainingPending[0]?.product_name;
      setMessage(
        remainingPending.length
          ? `✅ Invoice uploaded! Next: upload invoice for "${nextProductName || "the next product"}".`
          : "🎉 All invoices uploaded for this task! You can now submit your reviews."
      );
      setFile(null);
      setFileInputKey((prev) => prev + 1);
    } catch (err) {
      setError(err.response?.data?.message || "Proof upload failed.");
    }
  };

  const allInvoicesDone = totalProducts > 0 && remainingInvoiceCount === 0;

  return (
    <div className="participant-upload-page">
      <header className="participant-upload-topbar">
        <div className="participant-upload-brand">Nitro</div>
        <nav>
          <button type="button" onClick={() => navigate(participantDashboardPath)}>Dashboard</button>
          <button type="button" className="active" onClick={() => navigate(participantAllocationPath)}>My Tasks</button>
          <button type="button" onClick={() => navigate(participantPayoutPath)}>Payouts</button>
        </nav>
      </header>

      <main className="participant-upload-main">
        {/* Page Header */}
        <div className="upf-page-header">
          <div>
            <h1 className="upf-page-title">Submit Invoice &amp; Review</h1>
            <p className="upf-page-subtitle">Complete all steps below for each product you purchased.</p>
          </div>
          <button type="button" className="participant-action-back" onClick={() => navigate(participantAllocationPath)}>
            ← Back to My Tasks
          </button>
        </div>

        {/* How It Works */}
        <div className="upf-how-it-works">
          <div className="upf-step-badge">
            <span className="upf-step-num">1</span>
            <div>
              <strong>Buy the product</strong>
              <p>Purchase on Amazon using your own account</p>
            </div>
          </div>
          <div className="upf-step-arrow">→</div>
          <div className="upf-step-badge">
            <span className="upf-step-num">2</span>
            <div>
              <strong>Upload invoice</strong>
              <p>Screenshot or PDF of your order confirmation</p>
            </div>
          </div>
          <div className="upf-step-arrow">→</div>
          <div className="upf-step-badge">
            <span className="upf-step-num">3</span>
            <div>
              <strong>Submit review</strong>
              <p>Share your review link after posting on Amazon</p>
            </div>
          </div>
        </div>

        {error ? <div className="participant-action-error" style={{ marginBottom: "1rem" }}>{error}</div> : null}
        {message ? <div className="participant-action-success" style={{ marginBottom: "1rem" }}>{message}</div> : null}
        {loading ? <div className="upf-loading">Loading your tasks…</div> : null}
        {!loading && !allocations.length ? (
          <div className="upf-empty">
            <div className="upf-empty-icon">📭</div>
            <strong>No pending tasks</strong>
            <p>You have no invoices to upload right now. Check back after your products are approved.</p>
          </div>
        ) : null}

        {!loading && allocations.length ? (
          <div className="upf-layout">
            {/* LEFT — Task + Progress panel */}
            <aside className="upf-sidebar">
              {/* Task selector */}
              <div className="upf-panel">
                <div className="upf-panel-label">📋 Your Task</div>
                {allocations.length === 1 ? (
                  <div className="upf-task-single">
                    {selectedAllocation?.projects?.title || selectedAllocation?.projects?.name || "Task"}
                  </div>
                ) : (
                  <select
                    className="upf-select"
                    value={allocationId}
                    onChange={(e) => setAllocationId(e.target.value)}
                  >
                    {allocations.map((row) => {
                      const title = row?.projects?.title || row?.projects?.name || row.id;
                      return <option key={row.id} value={row.id}>{title}</option>;
                    })}
                  </select>
                )}
                {selectedAllocation ? (
                  <span className="upf-status-chip">
                    {String(selectedAllocation?.status || "RESERVED").toUpperCase()}
                  </span>
                ) : null}
              </div>

              {/* Progress */}
              {totalProducts > 0 ? (
                <div className="upf-panel">
                  <div className="upf-panel-label">📊 Invoice Progress</div>
                  <div className="upf-progress-track">
                    <div className="upf-progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="upf-progress-stats">
                    <span><strong>{uploadedInvoiceCount}</strong> uploaded</span>
                    <span><strong>{remainingInvoiceCount}</strong> remaining</span>
                  </div>
                </div>
              ) : null}

              {/* Product checklist */}
              {allocationProducts.length > 0 ? (
                <div className="upf-panel">
                  <div className="upf-panel-label">🛒 Products in this task</div>
                  <div className="upf-product-checklist">
                    {allocationProducts.map((product) => {
                      const done = Boolean(product?.purchase_proof);
                      const isCurrent = product.product_id === productId;
                      return (
                        <button
                          key={product.product_id || product.application_id}
                          type="button"
                          className={`upf-product-item ${done ? "upf-product-done" : isCurrent ? "upf-product-current" : "upf-product-pending"}`}
                          onClick={() => { if (!done) setProductId(product.product_id || ""); }}
                          disabled={done}
                          title={done ? "Invoice already uploaded" : "Click to select this product"}
                        >
                          <span className="upf-product-check">{done ? "✓" : isCurrent ? "●" : "○"}</span>
                          <span className="upf-product-name">{product.product_name || "Product"}</span>
                          <span className={`upf-product-badge ${done ? "upf-badge-done" : "upf-badge-pending"}`}>
                            {done ? "Done" : "Pending"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </aside>

            {/* RIGHT — Upload form */}
            <div className="upf-main-col">
              {allInvoicesDone ? (
                /* All done state */
                <div className="upf-all-done">
                  <div className="upf-all-done-icon">🎉</div>
                  <h2>All invoices uploaded!</h2>
                  <p>You've uploaded invoices for all {totalProducts} product{totalProducts > 1 ? "s" : ""}. The next step is to submit your reviews on Amazon and then upload your review links.</p>
                  <button
                    type="button"
                    className="upf-btn-primary"
                    onClick={() => navigate(`/participant/${id}/submit-review/${allocationId}`)}
                  >
                    Go to Review Upload →
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="upf-form">
                  {/* Current product being uploaded */}
                  {selectedProduct ? (
                    <div className="upf-current-product-banner">
                      <div className="upf-current-product-label">Uploading invoice for:</div>
                      <div className="upf-current-product-name">{selectedProduct.product_name || "Product"}</div>
                      {pendingProducts.length > 1 ? (
                        <div className="upf-current-product-sub">
                          {remainingInvoiceCount} of {totalProducts} invoices remaining
                        </div>
                      ) : null}
                    </div>
                  ) : pendingProducts.length === 1 ? (
                    <div className="upf-current-product-banner">
                      <div className="upf-current-product-label">Uploading invoice for:</div>
                      <div className="upf-current-product-name">{pendingProducts[0].product_name || "Product"}</div>
                    </div>
                  ) : null}

                  {/* Product selector (only when multiple pending) */}
                  {pendingProducts.length > 1 ? (
                    <div className="upf-field">
                      <label className="upf-label" htmlFor="productId">
                        Select product to upload invoice for
                      </label>
                      <select
                        id="productId"
                        className="upf-select"
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                      >
                        {pendingProducts.map((product) => (
                          <option key={product.product_id || product.application_id} value={product.product_id || ""}>
                            {product.product_name || "Product"}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {/* File drop zone */}
                  <div className="upf-field">
                    <label className="upf-label">Upload your order invoice / screenshot</label>
                    <div
                      className={`upf-dropzone ${dragOver ? "upf-dropzone-active" : ""} ${file ? "upf-dropzone-filled" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const dropped = e.dataTransfer.files[0];
                        if (dropped) handleFileChange(dropped);
                      }}
                    >
                      {file ? (
                        <div className="upf-dropzone-chosen">
                          <span className="upf-file-icon">📄</span>
                          <div>
                            <div className="upf-file-name">{file.name}</div>
                            <div className="upf-file-size">{(file.size / 1024).toFixed(1)} KB</div>
                          </div>
                          <button
                            type="button"
                            className="upf-file-remove"
                            onClick={() => { setFile(null); setFileInputKey((prev) => prev + 1); }}
                          >✕</button>
                        </div>
                      ) : (
                        <div className="upf-dropzone-empty">
                          <div className="upf-dropzone-icon">📁</div>
                          <div className="upf-dropzone-text">Drag &amp; drop your file here, or</div>
                          <label className="upf-browse-btn" htmlFor={`proofFile-${fileInputKey}`}>
                            Browse File
                          </label>
                          <div className="upf-dropzone-hint">Supports: JPG, PNG, PDF • Max 10 MB</div>
                        </div>
                      )}
                      <input
                        key={fileInputKey}
                        id={`proofFile-${fileInputKey}`}
                        type="file"
                        accept="image/*,.pdf"
                        style={{ display: "none" }}
                        onChange={(e) => handleFileChange(e.target.files[0])}
                      />
                    </div>
                  </div>

                  {/* What to upload tip */}
                  <div className="upf-tip">
                    <span className="upf-tip-icon">💡</span>
                    <span>Upload your <strong>Amazon order confirmation</strong> email screenshot or the order invoice PDF. Make sure the product name and price are clearly visible.</span>
                  </div>

                  {/* Action buttons */}
                  <div className="upf-form-actions">
                    <button type="submit" className="upf-btn-primary" disabled={!file}>
                      Upload Invoice
                    </button>
                    <button
                      type="button"
                      className="upf-btn-secondary"
                      onClick={() => navigate(`/participant/${id}/submit-review/${allocationId}${productId ? `?product=${encodeURIComponent(productId)}` : ""}`)}
                    >
                      Go to Review Upload →
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default UploadProof;