import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getMyAllocationTracking } from "../../api/allocation.api";
import { uploadPurchaseProof } from "../../api/verification.api";
import { submitReview, uploadReviewProofs } from "../../api/participant.api";
import "./ProductTask.css";

/* ─── helpers ─── */
const fmt = (v) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v || 0));

const proofIsDone   = (p) => Boolean(p) && String(p?.status || "").toUpperCase() !== "REJECTED";
const reviewIsDone  = (r) => Boolean(r) && String(r?.status || "").toUpperCase() !== "REJECTED";
const statusLabel   = (s) => String(s?.status || "PENDING").toUpperCase();

const ProductTask = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { id, allocationId: routeAllocId } = useParams();
  const qs        = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const routeProdId = qs.get("product") || "";

  /* data */
  const [allocations, setAllocations]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [globalError, setGlobalError]   = useState("");

  /* selection */
  const [allocId, setAllocId]   = useState("");
  const [prodId,  setProdId]    = useState("");

  /* invoice upload */
  const [invoiceFile, setInvoiceFile]   = useState(null);
  const [invoiceDrag, setInvoiceDrag]   = useState(false);
  const [invoiceKey,  setInvoiceKey]    = useState(0);
  const [invoiceBusy, setInvoiceBusy]   = useState(false);
  const [invoiceMsg,  setInvoiceMsg]    = useState("");
  const [invoiceErr,  setInvoiceErr]    = useState("");

  /* review submit */
  const [reviewUrl,   setReviewUrl]     = useState("");
  const [reviewText,  setReviewText]    = useState("");
  const [reviewFiles, setReviewFiles]   = useState([]);
  const [reviewBusy,  setReviewBusy]    = useState(false);
  const [reviewMsg,   setReviewMsg]     = useState("");
  const [reviewErr,   setReviewErr]     = useState("");

  const paths = {
    dashboard: id ? `/participant/${id}/dashboard`       : "/dashboard",
    tasks:     id ? `/participant/${id}/allocation/active` : "/dashboard",
    payouts:   id ? `/participant/${id}/payouts`          : "/dashboard",
  };

  /* ── load ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res  = await getMyAllocationTracking();
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        setAllocations(rows);

        // prefer the allocation from route
        const match = routeAllocId && rows.find((r) => r.id === routeAllocId);
        const alloc = match || rows.find((r) => ["RESERVED","PURCHASED"].includes(String(r?.status||"").toUpperCase())) || rows[0];
        if (alloc) {
          setAllocId(alloc.id);
          // prefer product from route
          const products = Array.isArray(alloc.selected_products) ? alloc.selected_products : [];
          const matchProd = routeProdId && products.find((p) => p.product_id === routeProdId);
          const firstPending = products.find((p) => !proofIsDone(p.purchase_proof));
          const chosen = matchProd || firstPending || products[0];
          if (chosen) setProdId(chosen.product_id || "");
        }
      } catch (err) {
        setGlobalError(err.response?.data?.message || "Unable to load tasks.");
      } finally { setLoading(false); }
    })();
  }, [routeAllocId, routeProdId]);

  /* ── derived ── */
  const selectedAlloc = useMemo(() => allocations.find((r) => r.id === allocId) || null, [allocations, allocId]);
  const products      = useMemo(() => Array.isArray(selectedAlloc?.selected_products) ? selectedAlloc.selected_products : [], [selectedAlloc]);
  const selectedProd  = useMemo(() => products.find((p) => p.product_id === prodId) || products[0] || null, [products, prodId]);

  const proof  = selectedProd?.purchase_proof  || null;
  const review = selectedProd?.review_submission || null;
  const invDone    = proofIsDone(proof);
  const revDone    = reviewIsDone(review);
  const invStatus  = statusLabel(proof);
  const revStatus  = statusLabel(review);
  const allDone    = products.length > 0 && products.every((p) => proofIsDone(p.purchase_proof) && reviewIsDone(p.review_submission));

  /* reset ALL form state when switching product or allocation */
  useEffect(() => {
    setInvoiceMsg("");
    setInvoiceErr("");
    setInvoiceFile(null);
    setInvoiceKey((k) => k + 1);   // remounts the file input so it clears
    setReviewMsg("");
    setReviewErr("");
    setReviewUrl("");
    setReviewText("");
    setReviewFiles([]);
  }, [prodId, allocId]);

  /* ── submit invoice ── */
  const handleInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceFile) { setInvoiceErr("Please choose a file."); return; }
    setInvoiceBusy(true); setInvoiceErr(""); setInvoiceMsg("");
    try {
      const fd = new FormData();
      fd.append("file", invoiceFile);
      await uploadPurchaseProof(allocId, fd, prodId);

      // optimistic update
      setAllocations((prev) => prev.map((row) => {
        if (row.id !== allocId) return row;
        return {
          ...row,
          selected_products: (row.selected_products || []).map((p) =>
            p.product_id === prodId
              ? { ...p, purchase_proof: { status: "PENDING", created_at: new Date().toISOString() } }
              : p
          )
        };
      }));

      setInvoiceMsg("✅ Invoice uploaded! Now submit your review below.");
      setInvoiceFile(null);
      setInvoiceKey((k) => k + 1);
    } catch (err) {
      setInvoiceErr(err.response?.data?.message || "Upload failed. Please try again.");
    } finally { setInvoiceBusy(false); }
  };

  /* ── submit review ── */
  const handleReview = async (e) => {
    e.preventDefault();
    if (!reviewUrl.trim() && reviewFiles.length === 0 && !reviewText.trim()) {
      setReviewErr("Please add a review URL, screenshot, or write your review text."); return;
    }
    setReviewBusy(true); setReviewErr(""); setReviewMsg("");
    try {
      let finalUrl  = reviewUrl.trim();
      let finalText = reviewText.trim();

      if (reviewFiles.length > 0) {
        const fd = new FormData();
        reviewFiles.forEach((f) => fd.append("files", f));
        const up = await uploadReviewProofs(allocId, fd, prodId);
        const urls = Array.isArray(up?.data?.data?.review_urls) ? up.data.data.review_urls : [];
        if (urls[0]) finalUrl = finalUrl || urls[0];
        const extra = urls.slice(1);
        if (extra.length) finalText = finalText ? `${finalText}\n\nExtra screenshots:\n${extra.join("\n")}` : `Screenshots:\n${extra.join("\n")}`;
      }

      await submitReview({ allocationId: allocId, productId: prodId || undefined, reviewText: finalText, reviewUrl: finalUrl });

      setAllocations((prev) => prev.map((row) => {
        if (row.id !== allocId) return row;
        return {
          ...row,
          selected_products: (row.selected_products || []).map((p) =>
            p.product_id === prodId
              ? { ...p, review_submission: { status: "PENDING", created_at: new Date().toISOString(), review_url: finalUrl } }
              : p
          )
        };
      }));

      setReviewMsg("✅ Review submitted! Awaiting admin approval.");
      setReviewUrl(""); setReviewText(""); setReviewFiles([]);
    } catch (err) {
      setReviewErr(err.response?.data?.message || "Submission failed. Please try again.");
    } finally { setReviewBusy(false); }
  };

  /* ── render ── */
  if (loading) return (
    <div className="pt-page">
      <header className="pt-topbar"><div className="pt-brand">Nitro</div></header>
      <div className="pt-loading"><div className="pt-spinner" /><span>Loading your task…</span></div>
    </div>
  );

  return (
    <div className="pt-page">
      {/* topbar */}
      <header className="pt-topbar">
        <div className="pt-brand">Nitro</div>
        <nav className="pt-nav">
          <button type="button" onClick={() => navigate(paths.dashboard)}>Dashboard</button>
          <button type="button" className="active" onClick={() => navigate(paths.tasks)}>My Tasks</button>
          <button type="button" onClick={() => navigate(paths.payouts)}>Payouts</button>
        </nav>
      </header>

      <main className="pt-main">
        {/* page header */}
        <div className="pt-page-header">
          <div>
            <h1>Submit Invoice &amp; Review</h1>
            <p>Upload your purchase invoice and post your Amazon review for each product.</p>
          </div>
          <button type="button" className="pt-back-btn" onClick={() => navigate(paths.tasks)}>← Back to My Tasks</button>
        </div>

        {globalError && <div className="pt-global-error">{globalError}</div>}

        {!allocations.length && !globalError && (
          <div className="pt-empty">
            <div className="pt-empty-icon">📭</div>
            <strong>No pending tasks found</strong>
            <p>All your invoices and reviews are up to date!</p>
            <button type="button" onClick={() => navigate(paths.tasks)}>Back to My Tasks</button>
          </div>
        )}

        {allocations.length > 0 && (
          <div className="pt-layout">
            {/* ── LEFT SIDEBAR ── */}
            <aside className="pt-sidebar">
              {/* Campaign */}
              <div className="pt-panel">
                <div className="pt-panel-label">📋 Campaign</div>
                {allocations.length > 1 ? (
                  <select className="pt-select" value={allocId} onChange={(e) => setAllocId(e.target.value)}>
                    {allocations.map((r) => <option key={r.id} value={r.id}>{r?.projects?.title || r?.projects?.name || r.id}</option>)}
                  </select>
                ) : (
                  <div className="pt-campaign-name">{selectedAlloc?.projects?.title || selectedAlloc?.projects?.name || "Campaign"}</div>
                )}
                <span className="pt-status-chip">{String(selectedAlloc?.status || "RESERVED").toUpperCase()}</span>
              </div>

              {/* Product checklist */}
              {products.length > 0 && (
                <div className="pt-panel">
                  <div className="pt-panel-label">🛒 Products ({products.length})</div>
                  <div className="pt-product-list">
                    {products.map((p, idx) => {
                      const pDone = proofIsDone(p.purchase_proof);
                      const rDone = reviewIsDone(p.review_submission);
                      const isCur = p.product_id === prodId;
                      const bothDone = pDone && rDone;
                      return (
                        <button
                          key={p.product_id || idx}
                          type="button"
                          className={`pt-prod-btn ${isCur ? "pt-prod-current" : ""} ${bothDone ? "pt-prod-done" : ""}`}
                          onClick={() => setProdId(p.product_id || "")}
                        >
                          <div className="pt-prod-name">{p.product_name || "Product"}</div>
                          <div className="pt-prod-badges">
                            <span className={`pt-mini-badge ${pDone ? "green" : "yellow"}`}>Invoice: {pDone ? "✓" : "⬜"}</span>
                            <span className={`pt-mini-badge ${rDone ? "green" : "yellow"}`}>Review: {rDone ? "✓" : "⬜"}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Progress */}
              {products.length > 0 && (
                <div className="pt-panel">
                  <div className="pt-panel-label">📊 Overall Progress</div>
                  {(() => {
                    const invCount = products.filter((p) => proofIsDone(p.purchase_proof)).length;
                    const revCount = products.filter((p) => reviewIsDone(p.review_submission)).length;
                    const total    = products.length * 2;
                    const done     = invCount + revCount;
                    const pct      = Math.round((done / total) * 100);
                    return (
                      <>
                        <div className="pt-progress-bar"><div className="pt-progress-fill" style={{ width: `${pct}%` }} /></div>
                        <div className="pt-progress-stats">
                          <span>Invoices: {invCount}/{products.length}</span>
                          <span>Reviews: {revCount}/{products.length}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </aside>

            {/* ── RIGHT MAIN ── */}
            <div className="pt-content">
              {allDone ? (
                <div className="pt-all-done">
                  <div className="pt-all-done-icon">🎉</div>
                  <h2>All done!</h2>
                  <p>All invoices and reviews submitted. Check your payout status on the Payouts page.</p>
                  <button type="button" className="pt-btn-primary" onClick={() => navigate(paths.payouts)}>View Payouts →</button>
                </div>
              ) : selectedProd ? (
                <>
                  {/* Current product banner */}
                  <div className="pt-product-banner">
                    <div className="pt-product-banner-label">Currently working on:</div>
                    <div className="pt-product-banner-name">{selectedProd.product_name || "Product"}</div>
                    <div className="pt-product-banner-price">{fmt(selectedProd.product_value)}</div>
                  </div>

                  {/* ── STEP 1: Invoice ── */}
                  <div className={`pt-step-card ${invDone ? "pt-step-done" : "pt-step-active"}`}>
                    <div className="pt-step-header">
                      <div className="pt-step-num-badge">{invDone ? "✓" : "1"}</div>
                      <div>
                        <div className="pt-step-title">Upload Purchase Invoice</div>
                        <div className="pt-step-subtitle">Screenshot or PDF of your Amazon order confirmation</div>
                      </div>
                      <span className={`pt-status-tag ${invDone ? (invStatus === "APPROVED" ? "approved" : "pending") : "not-done"}`}>
                        {invDone ? (invStatus === "APPROVED" ? "✓ Approved" : "⏳ Under Review") : "Not uploaded"}
                      </span>
                    </div>

                    {invDone ? (
                      <div className="pt-step-done-body">
                        <p>{invStatus === "APPROVED" ? "Invoice has been approved by admin." : "Invoice submitted and pending admin review. You can still submit your review below."}</p>
                        {proof?.file_url && <a href={proof.file_url} target="_blank" rel="noreferrer" className="pt-view-link">View uploaded invoice →</a>}
                      </div>
                    ) : (
                      <form onSubmit={handleInvoice} className="pt-step-body">
                        {invoiceErr && <div className="pt-form-error">{invoiceErr}</div>}
                        {invoiceMsg && <div className="pt-form-success">{invoiceMsg}</div>}

                        {/* Drop zone */}
                        <div
                          className={`pt-dropzone ${invoiceDrag ? "pt-dropzone-over" : ""} ${invoiceFile ? "pt-dropzone-filled" : ""}`}
                          onDragOver={(e) => { e.preventDefault(); setInvoiceDrag(true); }}
                          onDragLeave={() => setInvoiceDrag(false)}
                          onDrop={(e) => { e.preventDefault(); setInvoiceDrag(false); const f = e.dataTransfer.files[0]; if (f) setInvoiceFile(f); }}
                        >
                          {invoiceFile ? (
                            <div className="pt-dropzone-chosen">
                              <span className="pt-file-icon">📄</span>
                              <div className="pt-file-info">
                                <div className="pt-file-name">{invoiceFile.name}</div>
                                <div className="pt-file-size">{(invoiceFile.size / 1024).toFixed(1)} KB</div>
                              </div>
                              <button type="button" className="pt-file-remove" onClick={() => { setInvoiceFile(null); setInvoiceKey((k) => k + 1); }}>✕</button>
                            </div>
                          ) : (
                            <div className="pt-dropzone-idle">
                              <div className="pt-dz-icon">📁</div>
                              <div className="pt-dz-text">Drag &amp; drop your invoice here, or</div>
                              <label className="pt-browse-btn" htmlFor={`inv-file-${invoiceKey}`}>Choose File</label>
                              <div className="pt-dz-hint">JPG · PNG · PDF — max 10 MB</div>
                            </div>
                          )}
                          <input key={invoiceKey} id={`inv-file-${invoiceKey}`} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={(e) => setInvoiceFile(e.target.files[0])} />
                        </div>

                        <div className="pt-tip">
                          💡 Upload your <strong>Amazon order confirmation</strong> — make sure the product name and price are clearly visible.
                        </div>

                        <button type="submit" className="pt-btn-primary" disabled={!invoiceFile || invoiceBusy}>
                          {invoiceBusy ? "Uploading…" : "Upload Invoice →"}
                        </button>
                      </form>
                    )}
                  </div>

                  {/* ── STEP 2: Review ── */}
                  <div className={`pt-step-card ${revDone ? "pt-step-done" : invDone ? "pt-step-active" : "pt-step-unlocked"}`}>
                    <div className="pt-step-header">
                      <div className="pt-step-num-badge">{revDone ? "✓" : "2"}</div>
                      <div>
                        <div className="pt-step-title">Submit Amazon Review</div>
                        <div className="pt-step-subtitle">Post your review on Amazon, then submit the proof here</div>
                      </div>
                      <span className={`pt-status-tag ${revDone ? (revStatus === "APPROVED" ? "approved" : "pending") : invDone ? "not-done" : "locked"}`}>
                        {revDone ? (revStatus === "APPROVED" ? "✓ Approved" : "⏳ Under Review") : invDone ? "Ready to submit" : "Available after invoice"}
                      </span>
                    </div>

                    {revDone ? (
                      <div className="pt-step-done-body">
                        <p>{revStatus === "APPROVED" ? "Review approved by admin!" : "Review submitted and pending admin review."}</p>
                        {review?.review_url && <a href={review.review_url} target="_blank" rel="noreferrer" className="pt-view-link">View submitted review →</a>}
                      </div>
                    ) : (
                      <form onSubmit={handleReview} className="pt-step-body">
                        {!invDone && (
                          <div className="pt-step-locked-msg">
                            ℹ️ You can submit your review once you've uploaded the invoice above. You can also submit simultaneously if you have both ready.
                          </div>
                        )}

                        {reviewErr && <div className="pt-form-error">{reviewErr}</div>}
                        {reviewMsg && <div className="pt-form-success">{reviewMsg}</div>}

                        <div className="pt-form-field">
                          <label className="pt-label">Review URL <span className="pt-label-hint">(paste your Amazon review link)</span></label>
                          <input
                            type="url"
                            className="pt-input"
                            placeholder="https://www.amazon.in/review/..."
                            value={reviewUrl}
                            onChange={(e) => setReviewUrl(e.target.value)}
                          />
                        </div>

                        <div className="pt-form-divider"><span>or</span></div>

                        <div className="pt-form-field">
                          <label className="pt-label">Review Screenshot <span className="pt-label-hint">(upload a screenshot of your posted review)</span></label>
                          <div className="pt-review-upload-area">
                            <label className="pt-browse-btn" htmlFor={`rev-files-${prodId}`}>
                              {reviewFiles.length ? `${reviewFiles.length} file(s) selected` : "Choose Screenshot(s)"}
                            </label>
                            <input key={`rev-files-${prodId}`} id={`rev-files-${prodId}`} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => setReviewFiles(Array.from(e.target.files || []))} />
                            {reviewFiles.length > 0 && (
                              <button type="button" className="pt-file-remove" onClick={() => setReviewFiles([])}>✕ Clear</button>
                            )}
                          </div>
                        </div>

                        <div className="pt-form-field">
                          <label className="pt-label">Review Text <span className="pt-label-hint">(optional — paste your review text)</span></label>
                          <textarea
                            className="pt-textarea"
                            placeholder="Write or paste your review here…"
                            rows={4}
                            value={reviewText}
                            onChange={(e) => setReviewText(e.target.value)}
                          />
                        </div>

                        <div className="pt-tip">
                          💡 Minimum 150 words. Include photos if possible. Submit the review URL or screenshot as proof.
                        </div>

                        <button type="submit" className="pt-btn-primary" disabled={reviewBusy}>
                          {reviewBusy ? "Submitting…" : "Submit Review →"}
                        </button>
                      </form>
                    )}
                  </div>

                  {/* next product hint */}
                  {(() => {
                    const nextPending = products.find((p) => p.product_id !== prodId && (!proofIsDone(p.purchase_proof) || !reviewIsDone(p.review_submission)));
                    if (!nextPending) return null;
                    return (
                      <div className="pt-next-hint">
                        <span>Next product: <strong>{nextPending.product_name}</strong></span>
                        <button type="button" className="pt-btn-ghost" onClick={() => setProdId(nextPending.product_id || "")}>Switch →</button>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="pt-empty"><div className="pt-empty-icon">✅</div><strong>No pending steps</strong><p>All products completed!</p></div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProductTask;