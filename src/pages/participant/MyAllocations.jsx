import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getMyAllocationTracking, updateAllocationStatus } from "../../api/allocation.api";
import { uploadPurchaseProof } from "../../api/verification.api";
import { submitReview, uploadReviewProofs } from "../../api/participant.api";
import "./MyAllocations.css";

const PURCHASE_KEY_PREFIX = "nitro_purchased_";
const fmt = (v) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v || 0));
const proofDone  = (p) => Boolean(p) && String(p?.status || "").toUpperCase() !== "REJECTED";
const reviewDone = (r) => Boolean(r) && String(r?.status || "").toUpperCase() !== "REJECTED";
const statusOf   = (x) => String(x?.status || "PENDING").toUpperCase();

/* ── Confirmation Modal ── */
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

/* ── Inline Task Panel ── */
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

  const handleInvoice = async (e) => {
    e.preventDefault();
    if (!invFile) { setInvErr("Please choose a file."); return; }
    setInvBusy(true); setInvErr(""); setInvMsg("");
    try {
      const fd = new FormData();
      fd.append("file", invFile);
      await uploadPurchaseProof(allocId, fd, prod.product_id);
      onDataUpdate((prev) => prev.map((row) => row.id !== allocId ? row : {
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
        const up = await uploadReviewProofs(allocId, fd, prod.product_id);
        const urls = Array.isArray(up?.data?.data?.review_urls) ? up.data.data.review_urls : [];
        if (urls[0]) finalUrl = finalUrl || urls[0];
        const extra = urls.slice(1);
        if (extra.length) finalText = finalText ? `${finalText}\n\nExtra screenshots:\n${extra.join("\n")}` : `Screenshots:\n${extra.join("\n")}`;
      }
      await submitReview({ allocationId: allocId, productId: prod.product_id || undefined, reviewText: finalText, reviewUrl: finalUrl });
      onDataUpdate((prev) => prev.map((row) => row.id !== allocId ? row : {
        ...row,
        selected_products: (row.selected_products || []).map((p) =>
          p.product_id === prod.product_id ? { ...p, review_submission: { status: "PENDING", created_at: new Date().toISOString(), review_url: finalUrl } } : p
        )
      }));
      setRevMsg("✅ Review submitted! Awaiting admin approval.");
      setRevUrl(""); setRevText(""); setRevFiles([]);
      setTimeout(() => onClose(), 1400);
    } catch (err) {
      const msg = err.response?.data?.message || "Submission failed.";
      const alreadyDone = /already submitted/i.test(msg);
      if (alreadyDone) {
        // The review was already submitted (e.g. from another tab/session).
        // Treat it as a success: update local state so the UI shows it as done.
        onDataUpdate((prev) => prev.map((row) => row.id !== allocId ? row : ({
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
                {prod.purchase_proof?.file_url && <a href={prod.purchase_proof.file_url} target="_blank" rel="noreferrer" className="ma-inline-view-link">View uploaded invoice →</a>}
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
              <div className="ma-inline-tip">💡 Upload your <strong>Amazon order confirmation</strong> — make sure the product name and price are clearly visible.</div>
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
                {prod.review_submission?.review_url && <a href={prod.review_submission.review_url} target="_blank" rel="noreferrer" className="ma-inline-view-link">View submitted review →</a>}
              </div>
              <button type="button" className="ma-inline-btn-secondary" onClick={onClose}>Close Panel</button>
            </div>
          ) : (
            <form onSubmit={handleReview}>
              {revErr && <div className="ma-inline-error">{revErr}</div>}
              {revMsg && <div className="ma-inline-success">{revMsg}</div>}
              <div className="ma-inline-field">
                <label className="ma-inline-label">Review URL <span className="ma-inline-label-hint">(paste your Amazon review link)</span></label>
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

/* ════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════ */
const MyAllocations = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id }   = useParams();
  const query    = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryAllocId = query.get("allocation");
  const showHistory  = query.get("view") === "history";

  const [data,      setData]      = useState([]);
  const [activeId,  setActiveId]  = useState("");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [purchased, setPurchased] = useState({});
  const [panel,     setPanel]     = useState(null); // { prodId, step }
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [confirmBusy,  setConfirmBusy]  = useState(false);
  const [tick, setTick] = useState(0);

  const storageKey = `${PURCHASE_KEY_PREFIX}${id || "x"}`;

  useEffect(() => { const t = setInterval(() => setTick((p) => p + 1), 1000); return () => clearInterval(t); }, []);

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
        if (rows.length) {
          const match  = queryAllocId && rows.find((r) => r.id === queryAllocId);
          const active = rows.find((r) => ["RESERVED","PURCHASED"].includes(String(r?.status||"").toUpperCase()));
          setActiveId(match?.id || active?.id || rows[0].id);
        }
      } catch (err) { setError(err.response?.data?.message || "Failed to load tasks."); }
      finally { setLoading(false); }
    })();
  }, [queryAllocId]);

  const ACTIVE      = ["RESERVED","PURCHASED"];
  const currentData = useMemo(() => data.filter((r) => ACTIVE.includes(String(r?.status||"").toUpperCase())), [data]);
  const historyData = useMemo(() => data.filter((r) => !ACTIVE.includes(String(r?.status||"").toUpperCase())), [data]);
  const viewData    = showHistory ? historyData : currentData;

  const active = useMemo(() =>
    viewData.find((r) => r.id === activeId) || data.find((r) => r.id === activeId) || viewData[0] || data[0] || null
  , [activeId, viewData, data]);

  const products    = useMemo(() => Array.isArray(active?.selected_products) ? active.selected_products : [], [active]);
  const status      = String(active?.status || "RESERVED").toUpperCase();
  const isCompleted = status === "COMPLETED";
  const isPurchased = status === "PURCHASED";
  const isPurchaseConfirmed = Boolean(purchased[active?.id] || isPurchased || isCompleted || products.some((p) => proofDone(p.purchase_proof)));
  const project     = active?.projects || {};
  const projectName = project.title || project.name || "Campaign";
  const totalValue  = products.reduce((s, p) => s + Number(p?.product_value || 0), 0);
  const allInvDone  = products.length > 0 && products.every((p) => proofDone(p.purchase_proof));
  const allRevDone  = products.length > 0 && products.every((p) => reviewDone(p.review_submission));
  const allDone     = allInvDone && allRevDone;
  const anyUploaded = products.some((p) => proofDone(p.purchase_proof) || reviewDone(p.review_submission));

  const timeLeft = useMemo(() => {
    if (isCompleted || !active?.reserved_until) return { d:0, h:0, m:0, s:0 };
    let diff = Math.max(0, new Date(active.reserved_until).getTime() - Date.now());
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5);  diff -= h * 36e5;
    const m = Math.floor(diff / 6e4);   diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    return { d, h, m, s };
  }, [active, isCompleted, tick]);

  const P = {
    dash:    id ? `/participant/${id}/dashboard`                       : "/dashboard",
    tasks:   id ? `/participant/${id}/allocation/active`               : "/dashboard",
    history: id ? `/participant/${id}/allocation/active?view=history`  : "/dashboard",
    payouts: id ? `/participant/${id}/payouts`                         : "/dashboard",
  };

  const confirmPurchase = async () => {
    if (!active?.id || saving) return;
    setPurchased((prev) => ({ ...prev, [active.id]: true }));
    setSaving(true);
    try {
      await updateAllocationStatus(active.id, "PURCHASED");
      setData((prev) => prev.map((r) => r.id === active.id ? { ...r, status: "PURCHASED" } : r));
    } catch (err) { setError(err.response?.data?.message || "Could not update status."); }
    finally { setSaving(false); }
  };

  const handleConfirmSubmit = async () => {
    setConfirmBusy(true);
    await new Promise((res) => setTimeout(res, 1200));
    setConfirmBusy(false);
    setShowConfirm(false);
    navigate(P.payouts);
  };

  const history = useMemo(() => {
    const rows = [];
    (active?.selected_products || [null]).forEach((p, i) => {
      const proof    = p?.purchase_proof    || (p === null ? active?.purchase_proof    : null);
      const review   = p?.review_submission || (p === null ? active?.review_submission : null);
      const feedback = p?.feedback_submission || (p === null ? active?.feedback_submission : null);
      const pname    = p?.product_name ? ` · ${p.product_name}` : "";
      if (proof?.created_at)    rows.push({ key:`proof-${i}`,    at: proof.created_at,    label: `Invoice Uploaded${pname}`,    status: statusOf(proof) });
      if (review?.created_at)   rows.push({ key:`review-${i}`,   at: review.created_at,   label: `Review Submitted${pname}`,   status: statusOf(review) });
      if (feedback?.created_at) rows.push({ key:`feedback-${i}`, at: feedback.created_at, label: `Feedback Submitted${pname}`, status: "SUBMITTED" });
    });
    return rows.sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [active]);

  const chipColor = (s) => ({ APPROVED:"#22c55e", PENDING:"#f59e0b", REJECTED:"#ef4444", SUBMITTED:"#3b82f6", COMPLETED:"#10b981", PURCHASED:"#06b6d4", RESERVED:"#06b6d4", EXPIRED:"#f97316" }[s] || "#94a3b8");

  const panelProduct = panel ? products.find((p) => p.product_id === panel.prodId) || null : null;

  return (
    <div className="ma-page">
      <header className="ma-topbar">
        <div className="ma-brand" onClick={() => navigate(P.dash)} role="button" tabIndex={0} onKeyDown={(e) => e.key==="Enter" && navigate(P.dash)}>Nitro</div>
        <nav className="ma-nav">
          <button type="button" onClick={() => navigate(P.dash)}>Dashboard</button>
          <button type="button" className={!showHistory ? "active" : ""} onClick={() => navigate(P.tasks)}>My Tasks</button>
          <button type="button" className={showHistory ? "active" : ""} onClick={() => navigate(P.history)}>History</button>
          <button type="button" onClick={() => navigate(P.payouts)}>Payouts</button>
        </nav>
      </header>

      <main className="ma-main">
        <div className="ma-page-head">
          <div>
            <h1>{showHistory ? "Task History" : "My Tasks"}</h1>
            <p>{showHistory ? "Completed and past campaigns." : "Complete each step to earn your reimbursement."}</p>
          </div>
        </div>

        {loading && <div className="ma-loading"><div className="ma-spinner" /><span>Loading your tasks…</span></div>}
        {error   && <div className="ma-error">{error}</div>}

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
                {viewData.length > 1 ? (
                  <div className="ma-switcher">
                    {viewData.map((r) => {
                      const name = r?.projects?.title || r?.projects?.name || "Untitled";
                      const s = String(r?.status||"").toUpperCase();
                      return (
                        <button key={r.id} type="button" className={`ma-switch-btn ${r.id === active?.id ? "active" : ""}`} onClick={() => { setActiveId(r.id); setPanel(null); }}>
                          <span className="ma-switch-name">{name}</span>
                          <span className="ma-switch-chip" style={{ color: chipColor(s) }}>{s}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <div className="ma-campaign-name">{projectName}</div>
                    <span className="ma-status-chip" style={{ background:`${chipColor(status)}22`, color:chipColor(status), border:`1px solid ${chipColor(status)}55` }}>{status}</span>
                  </>
                )}
              </div>

              {!showHistory && !isCompleted && (
                <div className="ma-panel">
                  <div className="ma-panel-label">⏰ Time Remaining</div>
                  <div className="ma-timer">
                    {[["d","DAYS"],["h","HRS"],["m","MIN"],["s","SEC"]].map(([k,label]) => (
                      <div key={k} className="ma-timer-cell">
                        <strong>{String(timeLeft[k]).padStart(2,"0")}</strong>
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
            </aside>

            <div className="ma-content">
              {/* STEP 1: Purchase */}
              {!showHistory && !isPurchaseConfirmed && (
                <div className="ma-card ma-card-active">
                  <div className="ma-card-step-num">Step 1</div>
                  <h2 className="ma-card-title">Confirm Your Purchase</h2>
                  <p className="ma-card-sub">Buy all approved products on Amazon using your own account, then confirm below to unlock the next steps.</p>
                  {products.length > 0 && (
                    <div className="ma-product-list">
                      <div className="ma-product-list-label">Products to buy ({products.length})</div>
                      {products.map((p, i) => (
                        <div key={p.product_id || i} className="ma-product-row">
                          <div className="ma-product-row-name">{p.product_name || "Product"}</div>
                          <div className="ma-product-row-price">{fmt(p.product_value)}</div>
                        </div>
                      ))}
                      <div className="ma-product-total"><span>Total to spend</span><strong>{fmt(totalValue)}</strong></div>
                    </div>
                  )}
                  <button type="button" className="ma-btn-primary" onClick={confirmPurchase} disabled={saving}>
                    {saving ? "Saving…" : "✓ I've Purchased All Products"}
                  </button>
                </div>
              )}

              {/* STEP 2+3: Per-product uploads */}
              {!showHistory && isPurchaseConfirmed && (
                <div className="ma-card">
                  <div className="ma-card-step-num">Steps 2 &amp; 3</div>
                  <h2 className="ma-card-title">Upload Invoice &amp; Review — Per Product</h2>
                  <p className="ma-card-sub">Each product needs its own invoice upload and review submission. Complete both for every product.</p>

                  <div className="ma-per-product-grid">
                    {products.length > 0 ? products.map((prod, i) => {
                      const inv   = prod?.purchase_proof;
                      const rev   = prod?.review_submission;
                      const iDone = proofDone(inv);
                      const rDone = reviewDone(rev);
                      const pId   = prod?.product_id || "";
                      const isPanelOpen = panel?.prodId === pId;

                      return (
                        <div key={pId || i} className={`ma-prod-card ${iDone && rDone ? "ma-prod-done" : ""}`}>
                          <div className="ma-prod-num">{iDone && rDone ? "✓" : i + 1}</div>
                          <div className="ma-prod-body">
                            <div className="ma-prod-name">{prod.product_name || "Product"}</div>
                            <div className="ma-prod-price">{fmt(prod.product_value)}</div>
                            <div className="ma-prod-steps">
                              {/* Invoice */}
                              <div className={`ma-prod-step ${iDone ? "done" : "todo"}`}>
                                <div className="ma-prod-step-icon">{iDone ? "✅" : "📄"}</div>
                                <div className="ma-prod-step-info">
                                  <div className="ma-prod-step-label">Invoice Upload</div>
                                  <div className="ma-prod-step-status">
                                    {iDone ? (statusOf(inv) === "APPROVED" ? "Approved ✓" : "⏳ Under Review") : "Not Uploaded"}
                                  </div>
                                </div>
                                {!iDone && (
                                  <button type="button" className={`ma-prod-btn ${isPanelOpen && panel?.step === "invoice" ? "active-btn" : ""}`}
                                    onClick={() => isPanelOpen && panel.step === "invoice" ? setPanel(null) : setPanel({ prodId: pId, step: "invoice" })}>
                                    {isPanelOpen && panel?.step === "invoice" ? "Close ✕" : "Upload Invoice →"}
                                  </button>
                                )}
                              </div>
                              {/* Review */}
                              <div className={`ma-prod-step ${rDone ? "done" : iDone ? "todo" : "locked"}`}>
                                <div className="ma-prod-step-icon">{rDone ? "✅" : iDone ? "⭐" : "🔒"}</div>
                                <div className="ma-prod-step-info">
                                  <div className="ma-prod-step-label">Review Submission</div>
                                  <div className="ma-prod-step-status">
                                    {rDone ? (statusOf(rev) === "APPROVED" ? "Approved ✓" : "⏳ Under Review") : iDone ? "Ready to submit" : "Upload Invoice First"}
                                  </div>
                                </div>
                                {iDone && !rDone && (
                                  <button type="button" className={`ma-prod-btn ${isPanelOpen && panel?.step === "review" ? "active-btn" : ""}`}
                                    onClick={() => isPanelOpen && panel.step === "review" ? setPanel(null) : setPanel({ prodId: pId, step: "review" })}>
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
                          <button type="button" className="ma-btn-primary" onClick={() => navigate(`/participant/${id}/product-task/${active.id}`)}>
                            Upload Invoice &amp; Review →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Inline panel */}
                  {panel && panelProduct && (
                    <InlineTaskPanel
                      prod={panelProduct}
                      allocId={active.id}
                      step={panel.step}
                      onStepChange={(s) => setPanel((p) => p ? { ...p, step: s } : null)}
                      onClose={() => setPanel(null)}
                      onDataUpdate={setData}
                    />
                  )}

                  {/* Submit all / progress banner */}
                  {anyUploaded && (
                    <div className="ma-submit-all-wrap">
                      {allDone ? (
                        <div className="ma-all-done-banner">
                          🎉 All invoices and reviews submitted!{" "}
                          <button type="button" className="ma-link-btn" onClick={() => setShowConfirm(true)}>Review &amp; Confirm Submission →</button>
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
                </div>
              )}

              {/* History */}
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
                          <div className="ma-history-time">{new Date(row.at).toLocaleString("en-IN", { dateStyle:"medium", timeStyle:"short" })}</div>
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
    </div>
  );
};

export default MyAllocations;