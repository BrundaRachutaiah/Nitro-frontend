import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { cancelAllocation, getMyAllocationTracking, updateAllocationStatus } from "../../api/allocation.api";
import { uploadPurchaseProof } from "../../api/verification.api";
import { submitReview, uploadReviewProofs } from "../../api/participant.api";
import { clearStoredTokens, getStoredToken, signOutFromSupabase } from "../../lib/auth";
import "./MyAllocations.css";

const PURCHASE_KEY_PREFIX = "nitro_purchased_";
const ACTIVE_ALLOCATION_STATUSES = ["RESERVED", "PURCHASED"];
const fmt = (v) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v || 0));
const proofDone  = (p) => Boolean(p) && String(p?.status || "").toUpperCase() !== "REJECTED";
const reviewDone = (r) => Boolean(r) && String(r?.status || "").toUpperCase() !== "REJECTED";
const statusOf   = (x) => String(x?.status || "PENDING").toUpperCase();
const purchaseButtonLabel = (mode) =>
  String(mode || "").toUpperCase() === "MARKETPLACE" ? "Buy on Amazon ↗" : "Buy via Brand Website ↗";

const ConfirmModal = ({ products, onClose, onConfirm, submitting }) => (
  <div className="ma-modal-overlay" onClick={onClose}>
    <div className="ma-modal" onClick={(e) => e.stopPropagation()}>
      <div className="ma-modal-icon">🎉</div>
      <h2 className="ma-modal-title">Everything looks correct?</h2>
      <p className="ma-modal-sub">Review your submissions below. Once confirmed, they will be sent to admin for approval.</p>
      <div className="ma-modal-list">
        {products.map((p, i) => {
          const iDone = proofDone(p.purchase_proof);
          const rDone = reviewDone(p.review_submission);
          return (
            <div key={p.product_id || i} className="ma-modal-prod-row">
              <div className="ma-modal-prod-name">{p.product_name || "Product"}</div>
              <div className="ma-modal-prod-checks">
                <span className={`ma-modal-check ${iDone ? "ok" : "missing"}`}>{iDone ? "✓" : "✗"} Invoice</span>
                <span className={`ma-modal-check ${rDone ? "ok" : "missing"}`}>{rDone ? "✓" : "✗"} Review</span>
              </div>
            </div>
          );
        })}
      </div>
      {products.some((p) => !proofDone(p.purchase_proof) || !reviewDone(p.review_submission)) && (
        <div className="ma-modal-warn">⚠️ Some items are still pending. You can confirm now and complete them later, or go back to finish first.</div>
      )}
      <div className="ma-modal-actions">
        <button type="button" className="ma-modal-btn-secondary" onClick={onClose} disabled={submitting}>← Go Back</button>
        <button type="button" className="ma-modal-btn-primary" onClick={onConfirm} disabled={submitting}>
          {submitting ? "Submitting…" : "Confirm & Submit to Admin →"}
        </button>
      </div>
    </div>
  </div>
);

const CancelModal = ({ projectName, products, onClose, onConfirm, busy }) => (
  <div className="ma-modal-overlay" onClick={onClose}>
    <div className="ma-modal" onClick={(e) => e.stopPropagation()}>
      <div className="ma-modal-icon" style={{ fontSize: "2.2rem" }}>⚠️</div>
      <h2 className="ma-modal-title">Cancel Reservation?</h2>
      <p className="ma-modal-sub">
        Are you sure you want to cancel your reservation for <strong>{projectName}</strong>?
        Your slot will be released and the budget returned to the project pool.
      </p>
      {products.length > 0 && (
        <div className="ma-modal-list">
          {products.map((p, i) => (
            <div key={p.product_id || i} className="ma-modal-prod-row">
              <div className="ma-modal-prod-name">{p.product_name || "Product"}</div>
              <span className="ma-modal-check missing">✕ Will be released</span>
            </div>
          ))}
        </div>
      )}
      <div className="ma-modal-warn" style={{ borderColor: "#e74c3c", color: "#c0392b", background: "#fff0f0" }}>
        ⚠️ This action cannot be undone. You will need to re-apply to participate again.
      </div>
      <div className="ma-modal-actions">
        <button type="button" className="ma-modal-btn-secondary" onClick={onClose} disabled={busy}>
          ← Keep Reservation
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          style={{
            padding: "12px 28px", borderRadius: "10px", fontWeight: 700,
            fontSize: "15px", border: "none", cursor: busy ? "not-allowed" : "pointer",
            background: busy ? "#ccc" : "linear-gradient(135deg,#e74c3c,#c0392b)",
            color: "#fff", opacity: busy ? 0.6 : 1
          }}
        >
          {busy ? "Cancelling…" : "Yes, Cancel Reservation"}
        </button>
      </div>
    </div>
  </div>
);

const InlineTaskPanel = ({ prod, allocId, step, onStepChange, onClose, onDataUpdate }) => {
  const [invFile, setInvFile] = useState(null);
  const [invDrag, setInvDrag] = useState(false);
  const [invKey,  setInvKey]  = useState(0);
  const [invBusy, setInvBusy] = useState(false);
  const [invMsg,  setInvMsg]  = useState("");
  const [invErr,  setInvErr]  = useState("");
  const [revUrl,   setRevUrl]   = useState("");
  const [revText,  setRevText]  = useState("");
  const [revFiles, setRevFiles] = useState([]);
  const [revBusy,  setRevBusy]  = useState(false);
  const [revMsg,   setRevMsg]   = useState("");
  const [revErr,   setRevErr]   = useState("");
  const panelRef = useRef(null);

  useEffect(() => { panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, []);

  const iDone = proofDone(prod?.purchase_proof);
  const rDone = reviewDone(prod?.review_submission);
  const effectiveAllocId = prod?._allocationId || allocId;

  const handleInvoice = async (e) => {
    e.preventDefault();
    if (!invFile) { setInvErr("Please choose a file."); return; }
    setInvBusy(true); setInvErr(""); setInvMsg("");
    try {
      const fd = new FormData();
      fd.append("file", invFile);
      await uploadPurchaseProof(effectiveAllocId, fd, prod.product_id);
      onDataUpdate((prev) => prev.map((row) => row.id !== effectiveAllocId ? row : {
        ...row,
        selected_products: (row.selected_products || []).map((p) =>
          p.product_id === prod.product_id ? { ...p, purchase_proof: { status: "PENDING", created_at: new Date().toISOString() } } : p
        )
      }));
      setInvMsg("✅ Invoice uploaded! Moving to review…");
      setInvFile(null); setInvKey((k) => k + 1);
      setTimeout(() => onStepChange("review"), 900);
    } catch (err) { setInvErr(err.response?.data?.message || "Upload failed."); }
    finally { setInvBusy(false); }
  };

  const handleReview = async (e) => {
    e.preventDefault();
    if (!revUrl.trim() && revFiles.length === 0 && !revText.trim()) { setRevErr("Please add a review URL, screenshot, or review text."); return; }
    setRevBusy(true); setRevErr(""); setRevMsg("");
    try {
      let finalUrl = revUrl.trim(), finalText = revText.trim();
      if (revFiles.length > 0) {
        const fd = new FormData();
        revFiles.forEach((f) => fd.append("files", f));
        const up = await uploadReviewProofs(effectiveAllocId, fd, prod.product_id);
        const urls = Array.isArray(up?.data?.data?.review_urls) ? up.data.data.review_urls : [];
        if (urls[0]) finalUrl = finalUrl || urls[0];
        const extra = urls.slice(1);
        if (extra.length) finalText = finalText ? `${finalText}\n\nExtra screenshots:\n${extra.join("\n")}` : `Screenshots:\n${extra.join("\n")}`;
      }
      await submitReview({ allocationId: effectiveAllocId, productId: prod.product_id || undefined, reviewText: finalText, reviewUrl: finalUrl });
      onDataUpdate((prev) => prev.map((row) => row.id !== effectiveAllocId ? row : ({
        ...row,
        selected_products: (row.selected_products || []).map((p) =>
          p.product_id === prod.product_id ? { ...p, review_submission: { status: "PENDING", created_at: new Date().toISOString(), review_url: finalUrl } } : p
        )
      })));
      setRevMsg("✅ Review submitted! Awaiting admin approval.");
      setRevUrl(""); setRevText(""); setRevFiles([]);
      setTimeout(() => onClose(), 1400);
    } catch (err) {
      const msg = err.response?.data?.message || "Submission failed.";
      if (/already submitted/i.test(msg)) {
        onDataUpdate((prev) => prev.map((row) => row.id !== effectiveAllocId ? row : ({
          ...row,
          selected_products: (row.selected_products || []).map((p) =>
            p.product_id === prod.product_id ? { ...p, review_submission: { status: "PENDING", created_at: new Date().toISOString() } } : p
          )
        })));
        setRevMsg("✅ Review already submitted — awaiting admin approval.");
        setTimeout(() => onClose(), 1400);
      } else {
        setRevErr(msg);
      }
    }
    finally { setRevBusy(false); }
  };

  return (
    <div ref={panelRef} className="ma-inline-panel">
      <div className="ma-inline-panel-header">
        <div className="ma-inline-panel-title">{prod?.product_name || "Product"}</div>
        <button type="button" className="ma-inline-panel-close" onClick={onClose}>✕</button>
      </div>
      <div className="ma-inline-tabs">
        <button type="button" className={`ma-inline-tab ${step === "invoice" ? "active" : ""} ${iDone ? "done" : ""}`} onClick={() => onStepChange("invoice")}>
          {iDone ? "✓" : "1"} Upload Invoice
        </button>
        <div className="ma-inline-tab-arrow">→</div>
        <button type="button" className={`ma-inline-tab ${step === "review" ? "active" : ""} ${rDone ? "done" : ""} ${!iDone ? "locked" : ""}`} onClick={() => { if (iDone) onStepChange("review"); }}>
          {rDone ? "✓" : "2"} Submit Review
        </button>
      </div>

      {step === "invoice" && (
        <div className="ma-inline-body">
          {iDone ? (
            <div className="ma-inline-done-state">
              <div className="ma-inline-done-icon">✅</div>
              <div>
                <strong>Invoice already uploaded</strong>
                <p>Status: <span className="ma-inline-status-chip">{statusOf(prod.purchase_proof)}</span></p>
                {prod.purchase_proof?.file_url && (
                  <a href={prod.purchase_proof.file_url} target="_blank" rel="noreferrer" className="ma-inline-view-link">
                    View uploaded invoice →
                  </a>
                )}
              </div>
              <button type="button" className="ma-inline-btn-primary" onClick={() => onStepChange("review")}>Go to Review →</button>
            </div>
          ) : (
            <form onSubmit={handleInvoice}>
              {invErr && <div className="ma-inline-error">{invErr}</div>}
              {invMsg && <div className="ma-inline-success">{invMsg}</div>}
              <div
                className={`ma-inline-dropzone ${invDrag ? "over" : ""} ${invFile ? "filled" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setInvDrag(true); }}
                onDragLeave={() => setInvDrag(false)}
                onDrop={(e) => { e.preventDefault(); setInvDrag(false); const f = e.dataTransfer.files[0]; if (f) setInvFile(f); }}
              >
                {invFile ? (
                  <div className="ma-inline-file-chosen">
                    <span className="ma-inline-file-icon">📄</span>
                    <div className="ma-inline-file-info">
                      <div className="ma-inline-file-name">{invFile.name}</div>
                      <div className="ma-inline-file-size">{(invFile.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button type="button" className="ma-inline-file-remove" onClick={() => { setInvFile(null); setInvKey((k) => k + 1); }}>✕</button>
                  </div>
                ) : (
                  <div className="ma-inline-dz-idle">
                    <div className="ma-inline-dz-icon">📁</div>
                    <div className="ma-inline-dz-text">Drag &amp; drop your invoice here, or</div>
                    <label className="ma-inline-browse" htmlFor={`inv-${invKey}-${prod.product_id}`}>Choose File</label>
                    <div className="ma-inline-dz-hint">JPG · PNG · PDF — max 10 MB</div>
                  </div>
                )}
                <input key={invKey} id={`inv-${invKey}-${prod.product_id}`} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={(e) => setInvFile(e.target.files[0])} />
              </div>
              <div className="ma-inline-tip">💡 Upload your <strong>order confirmation</strong> — make sure the product name and price are clearly visible.</div>
              <button type="submit" className="ma-inline-btn-primary" disabled={!invFile || invBusy}>{invBusy ? "Uploading…" : "Upload Invoice →"}</button>
            </form>
          )}
        </div>
      )}

      {step === "review" && (
        <div className="ma-inline-body">
          {!iDone && (
            <div className="ma-inline-locked-msg">
              ℹ️ Please upload your invoice first.
              <button type="button" className="ma-inline-link-btn" onClick={() => onStepChange("invoice")}>Go to Invoice →</button>
            </div>
          )}
          {rDone ? (
            <div className="ma-inline-done-state">
              <div className="ma-inline-done-icon">✅</div>
              <div>
                <strong>Review already submitted</strong>
                <p>Status: <span className="ma-inline-status-chip">{statusOf(prod.review_submission)}</span></p>
                {prod.review_submission?.review_url && (
                  <a href={prod.review_submission.review_url} target="_blank" rel="noreferrer" className="ma-inline-view-link">
                    View submitted review →
                  </a>
                )}
              </div>
              <button type="button" className="ma-inline-btn-secondary" onClick={onClose}>Close Panel</button>
            </div>
          ) : (
            <form onSubmit={handleReview}>
              {revErr && <div className="ma-inline-error">{revErr}</div>}
              {revMsg && <div className="ma-inline-success">{revMsg}</div>}
              <div className="ma-inline-field">
                <label className="ma-inline-label">Review URL <span className="ma-inline-label-hint">(paste your review link)</span></label>
                <input type="url" className="ma-inline-input" placeholder="https://www.amazon.in/review/..." value={revUrl} onChange={(e) => setRevUrl(e.target.value)} />
              </div>
              <div className="ma-inline-or-divider"><span>or</span></div>
              <div className="ma-inline-field">
                <label className="ma-inline-label">Review Screenshot <span className="ma-inline-label-hint">(screenshot of your posted review)</span></label>
                <div className="ma-inline-file-row">
                  <label className="ma-inline-browse" htmlFor={`rev-${prod.product_id}`}>{revFiles.length ? `${revFiles.length} file(s) selected ✓` : "Choose Screenshot(s)"}</label>
                  <input id={`rev-${prod.product_id}`} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => setRevFiles(Array.from(e.target.files || []))} />
                  {revFiles.length > 0 && <button type="button" className="ma-inline-file-remove" onClick={() => setRevFiles([])}>✕ Clear</button>}
                </div>
              </div>
              <div className="ma-inline-field">
                <label className="ma-inline-label">Review Text <span className="ma-inline-label-hint">(optional)</span></label>
                <textarea className="ma-inline-textarea" placeholder="Write or paste your review here…" rows={3} value={revText} onChange={(e) => setRevText(e.target.value)} />
              </div>
              <div className="ma-inline-tip">💡 Minimum 150 words. Include photos if possible. Submit the review URL or screenshot as proof.</div>
              <button type="submit" className="ma-inline-btn-primary" disabled={revBusy || !iDone}>{revBusy ? "Submitting…" : "Submit Review →"}</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

const MyAllocations = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id }   = useParams();
  const query    = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const showHistory = query.get("view") === "history";

  const [data,         setData]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [saving,       setSaving]       = useState(false);
  const [purchased,    setPurchased]    = useState({});
  const [panel,        setPanel]        = useState(null);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [confirmBusy,  setConfirmBusy]  = useState(false);
  const [showCancel,   setShowCancel]   = useState(false);
  const [cancelBusy,   setCancelBusy]   = useState(false);
  const [cancelError,  setCancelError]  = useState("");
  const [tick,         setTick]         = useState(0);

  const storageKey = `${PURCHASE_KEY_PREFIX}${id || "x"}`;

  useEffect(() => {
    const t = setInterval(() => setTick((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try { const r = localStorage.getItem(storageKey); if (r) setPurchased(JSON.parse(r) || {}); } catch { setPurchased({}); }
  }, [storageKey]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(purchased)); } catch { /* ignore */ }
  }, [purchased, storageKey]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res  = await getMyAllocationTracking();
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        setData(rows);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load tasks.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const historyData = useMemo(() =>
    data.filter((r) => !ACTIVE_ALLOCATION_STATUSES.includes(String(r?.status || "").toUpperCase())),
    [data]
  );

  const activeAllocations = useMemo(() =>
    data.filter((r) => ACTIVE_ALLOCATION_STATUSES.includes(String(r?.status || "").toUpperCase())),
    [data]
  );

  const viewData = showHistory ? historyData : (activeAllocations.length > 0 ? activeAllocations : []);

  // On history tab use the first historical alloc; on tasks tab use the first active alloc
  const active = showHistory
    ? (historyData[0] || data[0] || null)
    : (activeAllocations[0] || data[0] || null);

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  const products = useMemo(() => {
    const all = [];
    // Use viewData so history tab shows the historical alloc's products
    const source = showHistory ? historyData : activeAllocations;
    for (const alloc of source) {
      const prods = Array.isArray(alloc.selected_products) ? alloc.selected_products : [];
      for (const p of prods) {
        all.push({ ...p, _allocationId: alloc.id });
      }
    }
    return all;
  }, [activeAllocations, historyData, showHistory]);

  const status = String(active?.status || "RESERVED").toUpperCase();

  const isCompleted = activeAllocations.length > 0 &&
    activeAllocations.every((a) => String(a?.status || "").toUpperCase() === "COMPLETED");

  const isPurchaseConfirmed = useMemo(() => {
    if (activeAllocations.length === 0) return false;
    return activeAllocations.every((alloc) =>
      Boolean(purchased[alloc.id]) ||
      ["PURCHASED", "COMPLETED"].includes(String(alloc?.status || "").toUpperCase()) ||
      (Array.isArray(alloc.selected_products) && alloc.selected_products.some((p) => proofDone(p.purchase_proof)))
    );
  }, [activeAllocations, purchased]);

  const projectName = useMemo(() => {
    const names = new Set(
      products.map((p) => String(p?.project_title || "").trim()).filter(Boolean)
    );
    if (names.size > 1) return "Multiple campaigns";
    if (names.size === 1) return Array.from(names)[0];
    return active?.projects?.title || active?.projects?.name || "Campaign";
  }, [products, active]);

  const totalValue = products.reduce((s, p) => s + Number(p?.product_value || 0), 0);
  const allInvDone = products.length > 0 && products.every((p) => proofDone(p.purchase_proof));
  const allRevDone = products.length > 0 && products.every((p) => reviewDone(p.review_submission));
  const allDone    = allInvDone && allRevDone;
  const allApproved = products.length > 0 && products.every(
    (p) => statusOf(p.purchase_proof) === "APPROVED" && statusOf(p.review_submission) === "APPROVED"
  );
  const anyUploaded = products.some((p) => proofDone(p.purchase_proof) || reviewDone(p.review_submission));

  const timeLeft = useMemo(() => {
    const _nowTick = tick;
    void _nowTick;
    if (isCompleted) return { d: 0, h: 0, m: 0, s: 0 };
    const deadlines = activeAllocations
      .map((a) => a.reserved_until)
      .filter(Boolean)
      .map((d) => new Date(d).getTime());
    if (!deadlines.length) return { d: 0, h: 0, m: 0, s: 0 };
    let diff = Math.max(0, Math.min(...deadlines) - Date.now());
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5);  diff -= h * 36e5;
    const m = Math.floor(diff / 6e4);   diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    return { d, h, m, s };
  }, [activeAllocations, isCompleted, tick]);

  const P = {
    dash:    id ? `/participant/${id}/dashboard`                      : "/dashboard",
    tasks:   id ? `/participant/${id}/allocation/active`              : "/dashboard",
    history: id ? `/participant/${id}/allocation/active?view=history` : "/dashboard",
    payouts: id ? `/participant/${id}/payouts`                        : "/dashboard",
  };

  const confirmPurchase = async () => {
    if (saving) return;
    setSaving(true);
    try {
      for (const alloc of activeAllocations) {
        setPurchased((prev) => ({ ...prev, [alloc.id]: true }));
        await updateAllocationStatus(alloc.id, "PURCHASED");
        setData((prev) => prev.map((r) =>
          r.id === alloc.id ? { ...r, status: "PURCHASED" } : r
        ));
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not update status.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSubmit = async () => {
    setConfirmBusy(true);
    await new Promise((res) => setTimeout(res, 1200));
    setConfirmBusy(false);
    setShowConfirm(false);
    navigate(P.payouts);
  };

  const handleCancel = async () => {
    if (activeAllocations.length === 0) {
      setCancelError("Could not find your allocation. Please refresh and try again.");
      return;
    }
    setCancelBusy(true);
    setCancelError("");
    try {
      for (const alloc of activeAllocations) {
        await cancelAllocation(alloc.id);
      }
      setShowCancel(false);
      setCancelBusy(false);
      navigate(P.dash);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to cancel. Please refresh and try again.";
      setCancelError(msg);
      setCancelBusy(false);
    }
  };

  const history = useMemo(() => {
    const rows = [];
    // Build from ALL allocations — active and historical — so history tab is complete
    const source = showHistory ? data : activeAllocations;
    for (const alloc of source) {
      const prods = Array.isArray(alloc?.selected_products) ? alloc.selected_products : [null];
      prods.forEach((p, i) => {
        const proof    = p?.purchase_proof    || (p === null ? alloc?.purchase_proof    : null);
        const review   = p?.review_submission || (p === null ? alloc?.review_submission : null);
        const feedback = p?.feedback_submission || (p === null ? alloc?.feedback_submission : null);
        const pname = p?.product_name ? ` · ${p.product_name}` : "";
        const key   = `${alloc.id}-${i}`;
        if (proof?.created_at)    rows.push({ key: `proof-${key}`,    at: proof.created_at,    label: `Invoice Uploaded${pname}`,    status: statusOf(proof) });
        if (review?.created_at)   rows.push({ key: `review-${key}`,   at: review.created_at,   label: `Review Submitted${pname}`,   status: statusOf(review) });
        if (feedback?.created_at) rows.push({ key: `feedback-${key}`, at: feedback.created_at, label: `Feedback Submitted${pname}`, status: "SUBMITTED" });
      });
    }
    return rows.sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [activeAllocations, data, showHistory]);

  const chipColor = (s) => ({
    APPROVED: "#22c55e", PENDING: "#f59e0b", REJECTED: "#ef4444",
    SUBMITTED: "#3b82f6", COMPLETED: "#10b981", PURCHASED: "#06b6d4",
    RESERVED: "#06b6d4", EXPIRED: "#f97316", CANCELLED: "#e74c3c"
  }[s] || "#94a3b8");

  const panelProduct = panel ? products.find((p) => p.product_id === panel.prodId) || null : null;

  return (
    <div className="ma-page">
      <header className="ma-topbar">
        <div
          className="ma-brand"
          onClick={() => navigate(P.dash)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && navigate(P.dash)}
        >
          Nitro
        </div>
        <nav className="ma-nav">
          <button type="button" onClick={() => navigate(P.dash)}>Dashboard</button>
          <button type="button" className={!showHistory ? "active" : ""} onClick={() => navigate(P.tasks)}>My Tasks</button>
          <button type="button" className={showHistory ? "active" : ""} onClick={() => navigate(P.history)}>History</button>
          <button type="button" onClick={() => navigate(P.payouts)}>Payouts</button>
          <button type="button" className="ma-logout" onClick={handleLogout}>Logout</button>
        </nav>
      </header>

      <main className="ma-main">
        <div className="ma-page-head">
          <div>
            <h1>{showHistory ? "Task History" : "My Tasks"}</h1>
            <p>{showHistory ? "Completed and past campaigns." : "Complete each step to earn your reimbursement."}</p>
          </div>
        </div>

        {loading && (
          <div className="ma-loading">
            <div className="ma-spinner" />
            <span>Loading your tasks…</span>
          </div>
        )}
        {error && <div className="ma-error">{error}</div>}

        {!loading && !data.length && (
          <div className="ma-empty">
            <div className="ma-empty-icon">📭</div>
            <strong>No tasks yet</strong>
            <p>Head to the Dashboard to browse campaigns.</p>
            <button type="button" onClick={() => navigate(P.dash)}>Go to Dashboard</button>
          </div>
        )}

        {!loading && data.length > 0 && !viewData.length && (
          <div className="ma-empty">
            <div className="ma-empty-icon">{showHistory ? "📂" : "✅"}</div>
            <strong>{showHistory ? "No history yet" : "No active tasks"}</strong>
            <p>{showHistory ? "Completed tasks will appear here." : "All done! Check your payout status."}</p>
            <button type="button" onClick={() => navigate(showHistory ? P.tasks : P.payouts)}>
              {showHistory ? "Go to My Tasks" : "View Payouts"}
            </button>
          </div>
        )}

        {!loading && viewData.length > 0 && (
          <div className="ma-layout">
            <aside className="ma-sidebar">
              <div className="ma-panel">
                <div className="ma-panel-label">📋 Campaign</div>
                <div className="ma-campaign-name">{projectName}</div>
                <span
                  className="ma-status-chip"
                  style={{
                    background: `${chipColor(status)}22`,
                    color: chipColor(status),
                    border: `1px solid ${chipColor(status)}55`
                  }}
                >
                  {status}
                </span>
              </div>

              {!showHistory && !isCompleted && (
                <div className="ma-panel">
                  <div className="ma-panel-label">⏰ Time Remaining</div>
                  <div className="ma-timer">
                    {[["d", "DAYS"], ["h", "HRS"], ["m", "MIN"], ["s", "SEC"]].map(([k, label]) => (
                      <div key={k} className="ma-timer-cell">
                        <strong>{String(timeLeft[k]).padStart(2, "0")}</strong>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!showHistory && (
                <div className="ma-panel">
                  <div className="ma-panel-label">💰 Estimated Payout</div>
                  <div className="ma-payout-amt">{fmt(totalValue)}</div>
                  <div className="ma-payout-note">Reimbursement after approval</div>
                </div>
              )}

              {!showHistory && (
                <div className="ma-panel">
                  <div className="ma-panel-label">📌 Steps Overview</div>
                  <div className="ma-steps-list">
                    {[
                      ["Reservation Confirmed", true],
                      ["Purchase Products",     isPurchaseConfirmed],
                      ["Upload Invoices",       allInvDone],
                      ["Submit Reviews",        allRevDone],
                    ].map(([label, done]) => (
                      <div key={label} className={`ma-step-item ${done ? "done" : ""}`}>
                        <span className="ma-step-dot">{done ? "✓" : "○"}</span>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!showHistory && !allDone && ["RESERVED", "PURCHASED"].includes(status) && (
                <div className="ma-panel" style={{ marginTop: "8px" }}>
                  <div className="ma-panel-label" style={{ color: "#e74c3c" }}>⚠️ Cancel Reservation</div>
                  <p style={{ fontSize: "13px", color: "#9aa3b2", lineHeight: "1.5", margin: "8px 0 12px" }}>
                    Changed your mind? You can cancel your reservation at any time before completing your tasks.
                    The budget will be returned to the project pool.
                  </p>
                  {cancelError && (
                    <div style={{
                      fontSize: "13px", color: "#c0392b", background: "#fff0f0",
                      border: "1px solid #e74c3c", borderRadius: "8px",
                      padding: "8px 12px", marginBottom: "10px"
                    }}>
                      {cancelError}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { setCancelError(""); setShowCancel(true); }}
                    style={{
                      width: "100%", padding: "10px 16px", borderRadius: "8px",
                      fontWeight: 700, fontSize: "13px", cursor: "pointer",
                      background: "transparent", color: "#e74c3c",
                      border: "1.5px solid #e74c3c", letterSpacing: "0.3px"
                    }}
                  >
                    Cancel Reservation →
                  </button>
                </div>
              )}
            </aside>

            <div className="ma-content">
              {!showHistory && !isPurchaseConfirmed && (
                <div className="ma-card ma-card-active">
                  <div className="ma-card-step-num">Step 1</div>
                  <h2 className="ma-card-title">Confirm Your Purchase</h2>
                  <p className="ma-card-sub">
                    Buy all approved products using your own account, then confirm below to unlock the next steps.
                  </p>
                  {products.length > 0 && (
                    <div className="ma-product-list">
                      <div className="ma-product-list-label">Products to buy ({products.length})</div>
                     {products.map((p, i) => (
  <div key={p.product_id || i} className="ma-product-row">
    <div className="ma-product-row-name">
      <span>{p.product_name || "Product"}</span>

      <small style={{ display: "block", color: "#9aa3b2" }}>
        {p?.project_title || p?.projects?.title || projectName}
      </small>

      {p.product_url && (
        <a
          href={p.product_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ma-product-link"
        >
          {purchaseButtonLabel(p?.project_mode)}
        </a>
      )}
    </div>

    <div className="ma-product-row-price">
      {fmt(p.product_value)}
      {(p.quantity > 1) && (
        <div style={{ fontSize: '11px', color: '#9aa3b2', marginTop: '2px' }}>
          {p.quantity} × {fmt(p.unit_price)}
        </div>
      )}
    </div>
  </div>
))}
                      <div className="ma-product-total">
                        <span>Total to spend</span>
                        <strong>{fmt(totalValue)}</strong>
                      </div>
                    </div>
                  )}
                  <button type="button" className="ma-btn-primary" onClick={confirmPurchase} disabled={saving}>
                    {saving ? "Saving…" : "✓ I've Purchased All Products"}
                  </button>
                </div>
              )}

              {!showHistory && isPurchaseConfirmed && (
                <div className="ma-card">
                  <div className="ma-card-step-num">Steps 2 &amp; 3</div>
                  <h2 className="ma-card-title">Upload Invoice &amp; Review — Per Product</h2>
                  <p className="ma-card-sub">
                    Each product needs its own invoice upload and review submission. Complete both for every product.
                  </p>

                  {allApproved ? (
                    <div style={{
                      marginTop: "20px", padding: "28px 24px", borderRadius: "16px",
                      background: "linear-gradient(135deg, #0d2d1a 0%, #0a1f12 100%)",
                      border: "1.5px solid #22c55e44", textAlign: "center"
                    }}>
                      <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🎉</div>
                      <h3 style={{ color: "#22c55e", fontSize: "1.25rem", fontWeight: 700, marginBottom: "8px" }}>
                        All Tasks Completed!
                      </h3>
                      <p style={{ color: "#9aa3b2", fontSize: "14px", marginBottom: "20px", lineHeight: 1.6 }}>
                        All your invoices and reviews have been approved by admin.<br />
                        Your payout is being processed — check your payout status below.
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                        {products.map((p, i) => (
                          <div key={p.product_id || i} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 14px", borderRadius: "10px",
                            background: "#0a1a0e", border: "1px solid #22c55e22"
                          }}>
                            <span style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 600 }}>
                              {p.product_name || "Product"}
                            </span>
                            <span style={{ color: "#22c55e", fontSize: "12px", fontWeight: 700 }}>✓ Approved</span>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="ma-btn-primary"
                        onClick={() => navigate(P.payouts)}
                        style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
                      >
                        View My Payouts →
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="ma-per-product-grid">
                        {products.length > 0 ? products.map((prod, i) => {
                          const inv  = prod?.purchase_proof;
                          const rev  = prod?.review_submission;
                          const iDone = proofDone(inv);
                          const rDone = reviewDone(rev);
                          const pId   = prod?.product_id || "";
                          const isPanelOpen = panel?.prodId === pId;

                          return (
                            <div key={pId || i} className={`ma-prod-card ${iDone && rDone ? "ma-prod-done" : ""}`}>
                              <div className="ma-prod-num">{iDone && rDone ? "✓" : i + 1}</div>
                              <div className="ma-prod-body">
                                <div className="ma-prod-name">{prod.product_name || "Product"}</div>
                                <div className="ma-prod-price" style={{ marginTop: "-2px", marginBottom: "6px", fontSize: "12px", color: "#9aa3b2" }}>
                                  {prod?.project_title || prod?.projects?.title || projectName}
                                </div>
                                <div className="ma-prod-price">{fmt(prod.product_value)}</div>
                                <div className="ma-prod-steps">
                                  <div className={`ma-prod-step ${iDone ? "done" : "todo"}`}>
                                    <div className="ma-prod-step-icon">{iDone ? "✅" : "📄"}</div>
                                    <div className="ma-prod-step-info">
                                      <div className="ma-prod-step-label">Invoice Upload</div>
                                      <div className="ma-prod-step-status">
                                        {iDone ? (statusOf(inv) === "APPROVED" ? "Approved ✓" : "⏳ Under Review") : "Not Uploaded"}
                                      </div>
                                    </div>
                                    {!iDone && (
                                      <button
                                        type="button"
                                        className={`ma-prod-btn ${isPanelOpen && panel?.step === "invoice" ? "active-btn" : ""}`}
                                        onClick={() => isPanelOpen && panel.step === "invoice" ? setPanel(null) : setPanel({ prodId: pId, step: "invoice" })}
                                      >
                                        {isPanelOpen && panel?.step === "invoice" ? "Close ✕" : "Upload Invoice →"}
                                      </button>
                                    )}
                                  </div>
                                  <div className={`ma-prod-step ${rDone ? "done" : iDone ? "todo" : "locked"}`}>
                                    <div className="ma-prod-step-icon">{rDone ? "✅" : iDone ? "⭐" : "🔒"}</div>
                                    <div className="ma-prod-step-info">
                                      <div className="ma-prod-step-label">Review Submission</div>
                                      <div className="ma-prod-step-status">
                                        {rDone ? (statusOf(rev) === "APPROVED" ? "Approved ✓" : "⏳ Under Review") : iDone ? "Ready to submit" : "Upload Invoice First"}
                                      </div>
                                    </div>
                                    {iDone && !rDone && (
                                      <button
                                        type="button"
                                        className={`ma-prod-btn ${isPanelOpen && panel?.step === "review" ? "active-btn" : ""}`}
                                        onClick={() => isPanelOpen && panel.step === "review" ? setPanel(null) : setPanel({ prodId: pId, step: "review" })}
                                      >
                                        {isPanelOpen && panel?.step === "review" ? "Close ✕" : "Submit Review →"}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }) : (
                          <div className="ma-prod-card">
                            <div className="ma-prod-body" style={{ paddingLeft: 0 }}>
                              <div className="ma-prod-name">{projectName}</div>
                              <button
                                type="button"
                                className="ma-btn-primary"
                                onClick={() => navigate(`/participant/${id}/product-task/${active?.id}`)}
                              >
                                Upload Invoice &amp; Review →
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {panel && panelProduct && (
                        <InlineTaskPanel
                          prod={panelProduct}
                          allocId={panelProduct._allocationId || active?.id}
                          step={panel.step}
                          onStepChange={(s) => setPanel((p) => p ? { ...p, step: s } : null)}
                          onClose={() => setPanel(null)}
                          onDataUpdate={setData}
                        />
                      )}

                      {anyUploaded && (
                        <div className="ma-submit-all-wrap">
                          {allDone ? (
                            <div className="ma-all-done-banner">
                              🎉 All invoices and reviews submitted!{" "}
                              <button type="button" className="ma-link-btn" onClick={() => setShowConfirm(true)}>
                                Review &amp; Confirm Submission →
                              </button>
                            </div>
                          ) : (
                            <div className="ma-partial-submit-banner">
                              <span className="ma-partial-info">
                                {products.filter((p) => proofDone(p.purchase_proof)).length}/{products.length} invoices ·{" "}
                                {products.filter((p) => reviewDone(p.review_submission)).length}/{products.length} reviews submitted
                              </span>
                              <button type="button" className="ma-submit-all-btn" onClick={() => setShowConfirm(true)}>
                                Review &amp; Submit to Admin →
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="ma-card">
                <h2 className="ma-card-title">📋 Submission History</h2>
                {history.length === 0 ? (
                  <p className="ma-empty-note">No submissions yet for this task.</p>
                ) : (
                  <div className="ma-history-list">
                    {history.map((row) => (
                      <div key={row.key} className="ma-history-row">
                        <div className="ma-history-dot" style={{ background: chipColor(row.status) }} />
                        <div className="ma-history-info">
                          <div className="ma-history-label">{row.label}</div>
                          <div className="ma-history-time">
                            {new Date(row.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                          </div>
                        </div>
                        <span className="ma-history-status" style={{ color: chipColor(row.status) }}>{row.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {showConfirm && (
        <ConfirmModal
          products={products}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleConfirmSubmit}
          submitting={confirmBusy}
        />
      )}

      {showCancel && (
        <CancelModal
          projectName={projectName}
          products={products}
          onClose={() => { setShowCancel(false); setCancelError(""); }}
          onConfirm={handleCancel}
          busy={cancelBusy}
        />
      )}
    </div>
  );
};

export default MyAllocations;