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
  const selectedProduct = useMemo(() => {
    if (!allocationProducts.length) return null;
    return allocationProducts.find((product) => product.product_id === productId) || null;
  }, [allocationProducts, productId]);
  const totalProducts = allocationProducts.length;
  const uploadedInvoiceCount = useMemo(
    () => allocationProducts.filter((product) => Boolean(product?.purchase_proof)).length,
    [allocationProducts]
  );
  const remainingInvoiceCount = Math.max(0, totalProducts - uploadedInvoiceCount);
  const nextPendingProduct = useMemo(
    () => pendingProducts.find((product) => (product.product_id || "") !== (productId || "")) || pendingProducts[0] || null,
    [pendingProducts, productId]
  );

  useEffect(() => {
    if (pendingProducts.length) {
      const nextProductId = pendingProducts.some((product) => product.product_id === productId)
        ? productId
        : pendingProducts[0].product_id;
      setProductId(nextProductId || "");
      return;
    }
    setProductId("");
  }, [pendingProducts, productId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!allocationId || !file) {
      setError("Please select a task and upload proof.");
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
            ? {
                ...product,
                purchase_proof: {
                  ...(product?.purchase_proof || {}),
                  status: "PENDING",
                  created_at: new Date().toISOString()
                }
              }
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
          ? `Invoice uploaded. Next: upload invoice for ${nextProductName || "the next product"}.`
          : "All product invoices uploaded for this task. Now submit reviews."
      );
      setFile(null);
      setFileInputKey((prev) => prev + 1);
    } catch (err) {
      setError(err.response?.data?.message || "Proof upload failed.");
    }
  };

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
        <header className="participant-action-header">
          <div>
            <h1>Upload Purchase Proof</h1>
            <p>Select a task, upload invoice/screenshot, and submit for admin verification.</p>
          </div>
          <button type="button" className="participant-action-back" onClick={() => navigate(participantAllocationPath)}>
            Back to My Tasks
          </button>
        </header>

        <section className="participant-action-card">
          {error ? <p className="participant-action-error">{error}</p> : null}
          {message ? <p className="participant-action-success">{message}</p> : null}
          {loading ? <p className="participant-action-muted">Loading tasks...</p> : null}
          {!loading && !allocations.length ? (
            <p className="participant-action-muted">No pending tasks found for proof upload.</p>
          ) : null}

          {!loading && allocations.length ? (
            <form onSubmit={handleSubmit} className="participant-action-form">
              <label htmlFor="allocationId">Task</label>
              <select id="allocationId" value={allocationId} onChange={(e) => setAllocationId(e.target.value)}>
                {allocations.map((row) => {
                  const title = row?.projects?.title || row?.projects?.name || row.id;
                  return (
                    <option key={row.id} value={row.id}>
                      {title}
                    </option>
                  );
                })}
              </select>

              {selectedAllocation ? (
                <p className="participant-action-note">
                  Status: {String(selectedAllocation?.status || "-").toUpperCase()}
                  {Array.isArray(selectedAllocation?.selected_products) && selectedAllocation.selected_products.length
                    ? ` | Product set size: ${selectedAllocation.selected_products.length}`
                  : ""}
                </p>
              ) : null}
              {totalProducts ? (
                <div className="participant-upload-summary">
                  <strong>{uploadedInvoiceCount}/{totalProducts}</strong> invoices uploaded.
                  {" "}
                  {remainingInvoiceCount > 0
                    ? `${remainingInvoiceCount} remaining.`
                    : "All invoices uploaded. Proceed to review upload."}
                </div>
              ) : null}

              {pendingProducts.length ? (
                <>
                  <label htmlFor="productId">Product</label>
                  <select id="productId" value={productId} onChange={(e) => setProductId(e.target.value)}>
                    {pendingProducts.map((product) => (
                      <option key={product.product_id || product.application_id} value={product.product_id || ""}>
                        {product.product_name || "Product"}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
              {selectedProduct ? (
                <p className="participant-action-note">
                  Invoice: {selectedProduct?.purchase_proof ? "Uploaded" : "Pending"} | Review: {selectedProduct?.review_submission ? "Submitted" : "Pending"}
                </p>
              ) : null}
              {nextPendingProduct && remainingInvoiceCount > 0 && totalProducts > 1 ? (
                <p className="participant-action-note">
                  Next product after this: <strong>{nextPendingProduct?.product_name || "Product"}</strong>
                </p>
              ) : null}

              {pendingProducts.length > 1 ? (
                <div className="participant-upload-pending-list">
                  <p>Pending products</p>
                  <ul>
                    {pendingProducts.map((product) => (
                      <li key={product.product_id || product.application_id}>
                        {product?.product_name || "Product"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <label htmlFor="proofFile">Invoice/Proof File</label>
              <input
                key={fileInputKey}
                id="proofFile"
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setFile(e.target.files[0])}
              />

              <div className="participant-upload-actions">
                <button type="submit">Upload Invoice / Proof</button>
                <button
                  type="button"
                  className="participant-upload-secondary"
                  onClick={() => navigate(`/participant/${id}/submit-review/${allocationId}${productId ? `?product=${encodeURIComponent(productId)}` : ""}`)}
                >
                  Go To Review Upload
                </button>
              </div>
            </form>
          ) : null}
        </section>
      </main>
    </div>
  );
};

export default UploadProof;
