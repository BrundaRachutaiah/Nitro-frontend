/**
 * Admin Dashboard — Combined Admin + Participant Workflow
 *
 * Admin section : create/manage projects, stat cards, all projects table
 * Participant section : EXACT same workflow as participant dashboard
 *   - Browse Products (product cards, quantity, select+send)
 *   - Applied tab
 *   - Approved tab  (Submit Invoice & Review)
 *   - Cancelled tab
 *   - Completed tab
 *   - My Tasks page (Step1 confirm purchase → Step2 invoice upload → Step3 review submit)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  API_BASE_URL,
  clearStoredTokens,
  getStoredToken,
  signOutFromSupabase,
  verifyBackendUser,
} from "../../lib/auth";
import { uploadPurchaseProof } from "../../api/verification.api";
import { submitReview, uploadReviewProofs } from "../../api/participant.api";
import { updateAllocationStatus, cancelAllocation } from "../../api/allocation.api";
import "../superAdmin/Dashboard.css";
import "../participant/Dashboard.css";
import "../participant/MyAllocations.css";

/* ─── fetch helper ───────────────────────────────────────────────────────── */
const fetchJson = async (path, token, opts = {}) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    method:  opts.method || "GET",
    body:    opts.body,
    signal:  opts.signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
};

/* ─── shared helpers ─────────────────────────────────────────────────────── */
const fmtInr = (v) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v) || 0);
const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtNum  = (v) => new Intl.NumberFormat("en-US").format(Number(v) || 0);
const initials = (n) => String(n || "A")[0].toUpperCase();
const proofDone  = (p) => Boolean(p) && String(p?.status || "").toUpperCase() !== "REJECTED";
const reviewDone = (r) => Boolean(r) && String(r?.status || "").toUpperCase() !== "REJECTED";
const statusOf   = (x) => String(x?.status || "PENDING").toUpperCase();

const getCategoryColor = (cat) => {
  const map = {
    "baby care":       ["#f59e0b","#d97706"],
    "home essentials": ["#06b6d4","#0e7490"],
    "skincare":        ["#ec4899","#be185d"],
    "haircare":        ["#8b5cf6","#6d28d9"],
    "food":            ["#10b981","#047857"],
    "electronics":     ["#6366f1","#4338ca"],
  };
  const k = String(cat || "").toLowerCase();
  for (const [key, val] of Object.entries(map)) if (k.includes(key)) return val;
  return ["#17c8ef","#0e7490"];
};

/* ─── resolve card state (same logic as participant dashboard) ───────────── */
const resolveCardState = (latestApp, completedIds) => {
  if (!latestApp) return "FRESH";
  const wf     = String(latestApp?.workflow_status || "").toUpperCase();
  const payout = String(latestApp?.payout_status   || "").toUpperCase();
  const app    = String(latestApp?.status          || "").toUpperCase();
  const alloc  = String(latestApp?.allocation?.status || "").toUpperCase();
  if (wf === "COMPLETED" || payout === "PAID") return "COMPLETED";
  const pid = latestApp?.product_id || latestApp?.project_products?.id;
  if (pid && completedIds?.has(pid)) return "COMPLETED";
  if (app === "CANCELLED" || alloc === "CANCELLED") return "CANCELLED";
  if (app === "PURCHASED") return "PURCHASED";
  if (wf === "APPROVED" || wf === "SUBMITTED" || app === "APPROVED" || app === "COMPLETED") return "APPROVED";
  if (app === "PENDING")  return "PENDING";
  if (app === "REJECTED") return "REJECTED";
  return "FRESH";
};

const getLatestApp = (appRows, productId) => {
  if (!productId || !Array.isArray(appRows)) return null;
  const matches = appRows.filter((r) => (r?.product_id || r?.project_products?.id) === productId);
  if (!matches.length) return null;
  return matches.sort((a, b) => new Date(b.created_at||0) - new Date(a.created_at||0))[0];
};

/* ─── CARD_META (identical to participant dashboard) ─────────────────────── */
const CARD_META = {
  FRESH:     { pill: null,                                           pillCls: "",                    canSelect: true,  canTask: false },
  PENDING:   { pill: "⏳ Awaiting Admin Approval",                 pillCls: "nd-pill--pending",    canSelect: false, canTask: false },
  APPROVED:  { pill: "✓ Product Allocated to You",                 pillCls: "nd-pill--active",     canSelect: false, canTask: true  },
  CANCELLED: { pill: "✕ Allocation Cancelled",                     pillCls: "nd-pill--rejected",   canSelect: true,  canTask: false },
  PURCHASED: { pill: "🛒 Product Purchased — Complete Your Tasks",  pillCls: "nd-pill--purchased",  canSelect: false, canTask: true  },
  REJECTED:  { pill: "✕ Request Rejected",                         pillCls: "nd-pill--rejected",   canSelect: true,  canTask: false },
  COMPLETED: { pill: "★ Completed",                                 pillCls: "nd-pill--done",       canSelect: false, canTask: false },
};

/* ─── Toast ──────────────────────────────────────────────────────────────── */
let _toastId = 0;
const ToastContainer = ({ toasts, onDismiss }) => (
  <div className="nd-toast-container">
    {toasts.map((t) => (
      <div key={t.id} className={`nd-toast nd-toast--${t.type}`}>
        <div className="nd-toast-icon-wrap">
          {t.type === "success" && "✅"}{t.type === "error" && "❌"}
          {t.type === "warning" && "⚠️"}{t.type === "info"  && "ℹ️"}
        </div>
        <p className="nd-toast-msg">{t.message}</p>
        <button type="button" className="nd-toast-close" onClick={() => onDismiss(t.id)}>✕</button>
      </div>
    ))}
  </div>
);

/* ─── Status badge ───────────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const map = {
    PENDING:         ["Pending Review",    "badge--pending"],
    SUBMITTED:       ["Review Submitted",  "badge--pending"],
    PENDING_PAYMENT: ["Payment Pending",   "badge--pending"],
    APPROVED:        ["Approved",          "badge--approved"],
    REJECTED:        ["Rejected",          "badge--rejected"],
    CANCELLED:       ["Cancelled",         "badge--rejected"],
    PURCHASED:       ["In Progress",       "badge--purchased"],
    COMPLETED:       ["Completed",         "badge--completed"],
  };
  const [label, cls] = map[String(status||"").toUpperCase()] || [status, "badge--default"];
  return <span className={`nd-badge ${cls}`}>{label}</span>;
};

/* ─── Empty state ────────────────────────────────────────────────────────── */
const EmptyState = ({ icon, title, subtitle }) => (
  <div className="nd-empty">
    <div className="nd-empty-icon">{icon}</div>
    <h3>{title}</h3>
    <p>{subtitle}</p>
  </div>
);

/* ─── Product Card (identical to participant) ────────────────────────────── */
const ProductCard = ({ item, isSelected, latestApp, completedIds, onSelect, onNavigate, addToast, quantity, onQtyChange }) => {
  const cardState = resolveCardState(latestApp, completedIds);
  const { pill, pillCls, canSelect, canTask } = CARD_META[cardState];
  const [c1, c2] = getCategoryColor(item?.project_category);
  const initials2 = String(item?.name || "P").trim().slice(0, 2).toUpperCase();

  const actionLabel = () => {
    if (isSelected) return "✓ Selected";
    if (cardState === "CANCELLED") return "Request Again";
    if (cardState === "REJECTED")  return "Send New Request";
    return "Select Product";
  };

  const handleSelect = (e) => {
    e.stopPropagation();
    onSelect(item.selection_key);
    addToast(isSelected
      ? `"${(item?.name||"Product").slice(0,40)}" removed from your list.`
      : `"${(item?.name||"Product").slice(0,40)}" added to your request list.`, "info");
  };

  return (
    <article className={[
      "nd-product-card",
      isSelected          ? "nd-product-card--selected" : "",
      cardState === "PENDING"   ? "nd-product-card--pending"  : "",
      cardState === "APPROVED"  ? "nd-product-card--active"   : "",
      cardState === "PURCHASED" ? "nd-product-card--active"   : "",
      cardState === "COMPLETED" ? "nd-product-card--done"     : "",
    ].filter(Boolean).join(" ")}>
      <div className="nd-card-img"
        onClick={() => item?.product_url && window.open(item.product_url, "_blank", "noopener")}
        style={{ cursor: item?.product_url ? "pointer" : "default" }}>
        <div style={{
          width:"100%", height:"100%",
          background:`linear-gradient(135deg,${c1}18 0%,${c2}30 100%)`,
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8,
        }}>
          <div style={{
            width:52, height:52, borderRadius:14,
            background:`linear-gradient(135deg,${c1}40,${c2}60)`,
            border:`1.5px solid ${c1}50`, display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:"1.15rem", fontWeight:800, color:"#fff", boxShadow:`0 4px 16px ${c1}30`,
          }}>{initials2}</div>
        </div>
        <span className="nd-card-category">{item?.project_category || "General"}</span>
        {isSelected && <div className="nd-card-check">✓</div>}
      </div>

      <div className="nd-card-body">
        <h3 className="nd-card-title" title={item?.name}>{item?.name || "Product"}</h3>
        <div className="nd-card-meta">
          <span className="nd-card-client" title={item?.project_title}>🏢 {item?.project_title || "Project"}</span>
          <span className="nd-card-price">
            {fmtInr(item?.price ?? item?.product_value ?? 0)}
            {onQtyChange && (
              <div style={{ display:"flex", alignItems:"center", gap:8, margin:"8px 0", justifyContent:"center" }}>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); onQtyChange(Math.max(1, quantity - 1)); }}
                  style={{ width:28, height:28, borderRadius:"50%", border:"1px solid #3b82f6",
                    background: quantity <= 1 ? "#1e293b" : "#3b82f6", color:"#fff", fontWeight:700,
                    fontSize:16, cursor: quantity <= 1 ? "not-allowed" : "pointer",
                    display:"flex", alignItems:"center", justifyContent:"center" }}
                  disabled={quantity <= 1}>−</button>
                <span style={{ color:"#e2e8f0", fontWeight:700, minWidth:20, textAlign:"center" }}>{quantity}</span>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); onQtyChange(Math.min(10, quantity + 1)); }}
                  style={{ width:28, height:28, borderRadius:"50%", border:"1px solid #3b82f6",
                    background:"#3b82f6", color:"#fff", fontWeight:700, fontSize:16,
                    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
              </div>
            )}
            {quantity > 1 && (
              <div style={{ fontSize:11, color:"#22c55e", fontWeight:600, textAlign:"center", marginBottom:4 }}>
                Total: {fmtInr((item?.price ?? item?.product_value ?? 0) * quantity)}
              </div>
            )}
          </span>
        </div>
        {pill && <div className={`nd-pill ${pillCls}`}>{pill}</div>}
        <div className="nd-card-action">
          {canTask && (
            <button type="button" className="nd-btn nd-btn--task" onClick={(e) => { e.stopPropagation(); onNavigate(); }}>
              Go to My Tasks →
            </button>
          )}
          {canSelect && (
            <button type="button"
              className={`nd-btn ${isSelected ? "nd-btn--selected" : "nd-btn--select"}`}
              onClick={handleSelect}>
              {actionLabel()}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

/* ─── Inline Task Panel (from MyAllocations) ─────────────────────────────── */
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

  useEffect(() => { panelRef.current?.scrollIntoView({ behavior:"smooth", block:"nearest" }); }, []);

  const iDone = proofDone(prod?.purchase_proof);
  const rDone = reviewDone(prod?.review_submission);
  const effAllocId = prod?._allocationId || allocId;

  const handleInvoice = async (e) => {
    e.preventDefault();
    if (!invFile) { setInvErr("Please choose a file."); return; }
    setInvBusy(true); setInvErr(""); setInvMsg("");
    try {
      const fd = new FormData();
      fd.append("file", invFile);
      await uploadPurchaseProof(effAllocId, fd, prod.product_id);
      onDataUpdate((prev) => prev.map((row) => row.id !== effAllocId ? row : {
        ...row,
        selected_products: (row.selected_products || []).map((p) =>
          p.product_id === prod.product_id
            ? { ...p, purchase_proof: { status:"PENDING", created_at: new Date().toISOString() } }
            : p
        ),
      }));
      setInvMsg("✅ Invoice uploaded! Moving to review…");
      setInvFile(null); setInvKey((k) => k + 1);
      setTimeout(() => onStepChange("review"), 900);
    } catch (err) { setInvErr(err.response?.data?.message || "Upload failed."); }
    finally { setInvBusy(false); }
  };

  const handleReview = async (e) => {
    e.preventDefault();
    if (!revUrl.trim() && revFiles.length === 0 && !revText.trim()) {
      setRevErr("Please add a review URL, screenshot, or review text."); return;
    }
    setRevBusy(true); setRevErr(""); setRevMsg("");
    try {
      let finalUrl = revUrl.trim(), finalText = revText.trim();
      if (revFiles.length > 0) {
        const fd = new FormData();
        revFiles.forEach((f) => fd.append("files", f));
        const up = await uploadReviewProofs(effAllocId, fd, prod.product_id);
        const urls = Array.isArray(up?.data?.data?.review_urls) ? up.data.data.review_urls : [];
        if (urls[0]) finalUrl = finalUrl || urls[0];
        const extra = urls.slice(1);
        if (extra.length) finalText = finalText ? `${finalText}\n\nExtra:\n${extra.join("\n")}` : extra.join("\n");
      }
      await submitReview({ allocationId: effAllocId, productId: prod.product_id || undefined, reviewText: finalText, reviewUrl: finalUrl });
      onDataUpdate((prev) => prev.map((row) => row.id !== effAllocId ? row : ({
        ...row,
        selected_products: (row.selected_products || []).map((p) =>
          p.product_id === prod.product_id
            ? { ...p, review_submission: { status:"PENDING", created_at: new Date().toISOString(), review_url: finalUrl } }
            : p
        ),
      })));
      setRevMsg("✅ Review submitted! Awaiting admin approval.");
      setRevUrl(""); setRevText(""); setRevFiles([]);
      setTimeout(() => onClose(), 1400);
    } catch (err) {
      const msg = err.response?.data?.message || "Submission failed.";
      if (/already submitted/i.test(msg)) {
        onDataUpdate((prev) => prev.map((row) => row.id !== effAllocId ? row : ({
          ...row,
          selected_products: (row.selected_products || []).map((p) =>
            p.product_id === prod.product_id
              ? { ...p, review_submission: { status:"PENDING", created_at: new Date().toISOString() } }
              : p
          ),
        })));
        setRevMsg("✅ Review already submitted — awaiting admin approval.");
        setTimeout(() => onClose(), 1400);
      } else { setRevErr(msg); }
    } finally { setRevBusy(false); }
  };

  return (
    <div ref={panelRef} className="ma-inline-panel">
      <div className="ma-inline-panel-header">
        <div className="ma-inline-panel-title">{prod?.product_name || "Product"}</div>
        <button type="button" className="ma-inline-panel-close" onClick={onClose}>✕</button>
      </div>
      <div className="ma-inline-tabs">
        <button type="button" className={`ma-inline-tab ${step==="invoice"?"active":""} ${iDone?"done":""}`} onClick={() => onStepChange("invoice")}>
          {iDone ? "✓" : "1"} Upload Invoice
        </button>
        <div className="ma-inline-tab-arrow">→</div>
        <button type="button" className={`ma-inline-tab ${step==="review"?"active":""} ${rDone?"done":""} ${!iDone?"locked":""}`}
          onClick={() => { if (iDone) onStepChange("review"); }}>
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
              <div className={`ma-inline-dropzone ${invDrag?"over":""} ${invFile?"filled":""}`}
                onDragOver={(e) => { e.preventDefault(); setInvDrag(true); }}
                onDragLeave={() => setInvDrag(false)}
                onDrop={(e) => { e.preventDefault(); setInvDrag(false); const f = e.dataTransfer.files[0]; if (f) setInvFile(f); }}>
                {invFile ? (
                  <div className="ma-inline-file-chosen">
                    <span className="ma-inline-file-icon">📄</span>
                    <div className="ma-inline-file-info">
                      <div className="ma-inline-file-name">{invFile.name}</div>
                      <div className="ma-inline-file-size">{(invFile.size/1024).toFixed(1)} KB</div>
                    </div>
                    <button type="button" className="ma-inline-file-remove" onClick={() => { setInvFile(null); setInvKey((k)=>k+1); }}>✕</button>
                  </div>
                ) : (
                  <div className="ma-inline-dz-idle">
                    <div className="ma-inline-dz-icon">📁</div>
                    <div className="ma-inline-dz-text">Drag &amp; drop your invoice here, or</div>
                    <label className="ma-inline-browse" htmlFor={`inv-${invKey}-${prod.product_id}`}>Choose File</label>
                    <div className="ma-inline-dz-hint">JPG · PNG · PDF — max 10 MB</div>
                  </div>
                )}
                <input key={invKey} id={`inv-${invKey}-${prod.product_id}`} type="file" accept="image/*,.pdf"
                  style={{ display:"none" }} onChange={(e) => setInvFile(e.target.files[0])} />
              </div>
              <div className="ma-inline-tip">💡 Upload your <strong>order confirmation</strong> — product name and price must be visible.</div>
              <button type="submit" className="ma-inline-btn-primary" disabled={!invFile||invBusy}>
                {invBusy ? "Uploading…" : "Upload Invoice →"}
              </button>
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
                <input type="url" className="ma-inline-input" placeholder="https://www.amazon.in/review/..."
                  value={revUrl} onChange={(e) => setRevUrl(e.target.value)} />
              </div>
              <div className="ma-inline-or-divider"><span>or</span></div>
              <div className="ma-inline-field">
                <label className="ma-inline-label">Review Screenshot</label>
                <div className="ma-inline-file-row">
                  <label className="ma-inline-browse" htmlFor={`rev-${prod.product_id}`}>
                    {revFiles.length ? `${revFiles.length} file(s) selected ✓` : "Choose Screenshot(s)"}
                  </label>
                  <input id={`rev-${prod.product_id}`} type="file" accept="image/*" multiple
                    style={{ display:"none" }} onChange={(e) => setRevFiles(Array.from(e.target.files||[]))} />
                  {revFiles.length > 0 && <button type="button" className="ma-inline-file-remove" onClick={() => setRevFiles([])}>✕ Clear</button>}
                </div>
              </div>
              <div className="ma-inline-field">
                <label className="ma-inline-label">Review Text <span className="ma-inline-label-hint">(optional)</span></label>
                <textarea className="ma-inline-textarea" placeholder="Write or paste your review here…" rows={3}
                  value={revText} onChange={(e) => setRevText(e.target.value)} />
              </div>
              <div className="ma-inline-tip">💡 Minimum 150 words. Include photos if possible.</div>
              <button type="submit" className="ma-inline-btn-primary" disabled={revBusy||!iDone}>
                {revBusy ? "Submitting…" : "Submit Review →"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
const AdminDashboard = () => {
  const navigate = useNavigate();

  /* ── view state ── */
  const [view,        setView]      = useState("admin");   // "admin" | "participant" | "tasks"
  const [activeTab,   setActiveTab] = useState("catalog"); // participant tabs
  const [sidebarOpen, setSidebar]   = useState(false);

  /* ── shared ── */
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [toasts,  setToasts]  = useState([]);

  /* ── admin data ── */
  const [projects,     setProjects]  = useState([]);
  const [summary,      setSummary]   = useState(null);
  const [adminQuery,   setAdminQuery]   = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  /* ── participant data ── */
  const [dashProducts,    setDashProducts]    = useState([]);  // catalog
  const [appliedProjects, setAppliedProjects] = useState([]);
  const [completedProjects,setCompletedProjects] = useState([]);
  const [activeProjects,  setActiveProjects]  = useState([]);
  const [allocations,     setAllocations]     = useState([]);  // my/tracking

  /* ── product selection / request ── */
  const [selectedKeys,   setSelectedKeys]   = useState([]);
  const [quantities,     setQuantities]      = useState({});
  const [sendingReq,     setSendingReq]      = useState(false);
  const [clientFilter,   setClientFilter]    = useState("ALL");
  const [myPayouts,      setMyPayouts]        = useState([]);

  /* ── tasks state (from MyAllocations) ── */
  const [taskPanel,    setTaskPanel]    = useState(null);   // { prodId, step }
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [confirmBusy,  setConfirmBusy]  = useState(false);
  const [savingPurch,  setSavingPurch]  = useState(false);
  const [purchased,    setPurchased]    = useState({});
  const [showCancel,   setShowCancel]   = useState(false);
  const [cancelBusy,   setCancelBusy]   = useState(false);
  const [cancelError,  setCancelError]  = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => { const t = setInterval(() => setTick((p) => p + 1), 1000); return () => clearInterval(t); }, []);

  /* ── toasts ── */
  const addToast = useCallback((message, type = "info") => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);
  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  /* ── load all data ── */
  const loadAll = useCallback(async () => {
    const token = getStoredToken();
    if (!token) { navigate("/login", { replace: true }); return; }
    setLoading(true);
    try {
      const me = await verifyBackendUser(token);
      const role = String(me?.role || "").toUpperCase();
      if (role !== "ADMIN" && role !== "SUPER_ADMIN") { navigate("/dashboard", { replace: true }); return; }
      setUser(me);

      const [projRes, summaryRes, appliedRes, completedRes, activeRes, allocRes, catalogRes, payoutsRes] =
        await Promise.allSettled([
          fetchJson("/projects", token),
          fetchJson("/admin/dashboard/summary", token),
          fetchJson("/projects/applied", token),
          fetchJson("/projects/completed", token),
          fetchJson("/projects/active", token),
          fetchJson("/allocations/my/tracking", token),
          fetchJson("/projects/admin-products", token),
          fetchJson("/admin/payouts/my", token),
        ]);

      setProjects(projRes.status==="fulfilled" && Array.isArray(projRes.value?.data) ? projRes.value.data : []);
      setSummary(summaryRes.status==="fulfilled" ? summaryRes.value?.data || null : null);

      const nextApplied = appliedRes.status==="fulfilled" && Array.isArray(appliedRes.value?.data)
        ? appliedRes.value.data : [];
      setAppliedProjects(nextApplied);

      const dedicatedCompleted = completedRes.status==="fulfilled" && Array.isArray(completedRes.value?.data)
        ? completedRes.value.data : [];
      setCompletedProjects(dedicatedCompleted.length ? dedicatedCompleted :
        nextApplied.filter((i) =>
          ["COMPLETED"].includes(String(i?.status||"").toUpperCase()) ||
          ["COMPLETED"].includes(String(i?.allocation?.status||"").toUpperCase())
        )
      );

      setActiveProjects(activeRes.status==="fulfilled" && Array.isArray(activeRes.value?.data)
        ? activeRes.value.data : []);

      const allocData = allocRes.status==="fulfilled" && Array.isArray(allocRes.value?.data)
        ? allocRes.value.data : [];
      setAllocations(allocData);

      const catalogData = catalogRes.status==="fulfilled" && Array.isArray(catalogRes.value?.data)
        ? catalogRes.value.data : [];
      setDashProducts(catalogData.filter((p) => p.id && p.name));

      const payoutsData = payoutsRes.status==="fulfilled" && Array.isArray(payoutsRes.value?.data)
        ? payoutsRes.value.data : [];
      setMyPayouts(payoutsData);

    } catch (err) {
      if (/token|unauthorized|expired|forbidden/i.test(err.message)) {
        clearStoredTokens(); navigate("/login", { replace: true }); return;
      }
      addToast(err.message || "Unable to load dashboard.", "error");
    } finally { setLoading(false); }
  }, [navigate, addToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleLogout = async () => {
    const token = getStoredToken();
    await signOutFromSupabase(token);
    clearStoredTokens();
    navigate("/login", { replace: true });
  };

  /* ── admin derived ── */
  const myProjects = useMemo(() =>
    projects.filter((p) => p?.created_by && user?.id && p.created_by === user.id),
    [projects, user?.id]
  );
  const filteredProjects = useMemo(() => {
    const term = adminQuery.trim().toLowerCase();
    return projects.filter((p) => {
      const title  = String(p?.title||p?.name||"").toLowerCase();
      const status = String(p?.status||"").toUpperCase();
      return (!term || title.includes(term)) && (statusFilter==="ALL" || status===statusFilter);
    });
  }, [projects, adminQuery, statusFilter]);
  const publishedCount = useMemo(() => projects.filter((p) => String(p?.status||"").toUpperCase()==="PUBLISHED").length, [projects]);
  const draftCount     = useMemo(() => projects.filter((p) => String(p?.status||"").toUpperCase()==="DRAFT").length, [projects]);

  /* ── participant derived (same as participant Dashboard) ── */
  const allAppRows = useMemo(() =>
    [...appliedProjects, ...completedProjects], [appliedProjects, completedProjects]);

  const completedIds = useMemo(() => {
    const map = new Map();
    for (const item of completedProjects) {
      const pid = item?.product_id || item?.project_products?.id;
      if (!pid) continue;
      const t = new Date(item?.completed_at||item?.payout_created_at||item?.reviewed_at||item?.created_at||0).getTime();
      const ex = map.get(pid);
      const et = new Date(ex?.completed_at||ex?.payout_created_at||ex?.reviewed_at||ex?.created_at||0).getTime();
      if (!ex || t >= et) map.set(pid, item);
    }
    const ids = new Set();
    for (const item of map.values()) {
      if (String(item?.workflow_status||"").toUpperCase()==="COMPLETED")
        ids.add(item?.product_id||item?.project_products?.id);
    }
    return ids;
  }, [completedProjects]);

  const filteredCatalog = useMemo(() => {
    const term = "";
    return dashProducts.filter((item) => {
      const matchClient = clientFilter==="ALL" || String(item?.project_title||"").trim()===clientFilter;
      return matchClient;
    });
  }, [dashProducts, clientFilter]);

  const clientOptions = useMemo(() => {
    const u = new Set(dashProducts.map((i) => String(i?.project_title||"").trim()).filter(Boolean));
    return Array.from(u).sort();
  }, [dashProducts]);

  const selectedProducts = useMemo(() => {
    const s = new Set(selectedKeys);
    return dashProducts.filter((i) => s.has(i.selection_key));
  }, [dashProducts, selectedKeys]);

  const appliedRows = useMemo(() =>
    appliedProjects.filter((i) => ["PENDING","REJECTED"].includes(String(i?.status||"").toUpperCase())),
    [appliedProjects]
  );
  const cancelledRows = useMemo(() =>
    appliedProjects.filter((i) => {
      const a = String(i?.status||"").toUpperCase();
      const b = String(i?.allocation?.status||"").toUpperCase();
      return a==="CANCELLED" || (b==="CANCELLED" && a!=="APPROVED");
    }), [appliedProjects]
  );
  const approvedRows = useMemo(() => {
    const map = new Map();
    for (const item of completedProjects) {
      const wf  = String(item?.workflow_status||"").toUpperCase();
      const payout = String(item?.payout_status||"").toUpperCase();
      const app = String(item?.status||"").toUpperCase();
      const isApprovedApp = ["APPROVED","PURCHASED"].includes(app) || wf==="APPROVED";
      if (!isApprovedApp) continue;
      if (Boolean(item?.proof_status)||Boolean(item?.review_status)) continue;
      if (payout && ["ELIGIBLE","IN_BATCH","EXPORTED","PAID"].includes(payout)) continue;
      if (wf && wf!=="APPROVED") continue;
      if (item?.allocation?.id && String(item?.allocation?.status||"").toUpperCase()==="CANCELLED") continue;
      const pid = item?.product_id||item?.project_products?.id;
      if (!pid||completedIds.has(pid)) continue;
      const t = new Date(item?.reviewed_at||item?.created_at||0).getTime();
      const ex = map.get(pid);
      if (!ex || t >= new Date(ex?.reviewed_at||ex?.created_at||0).getTime()) map.set(pid, item);
    }
    return Array.from(map.values()).map((item) => ({
      id: item?.product_id||item?.project_products?.id||item.id,
      allocationId: item?.allocation?.id||null,
      badgeStatus: "APPROVED",
      productName: item?.project_products?.name||item?.product_name||"—",
      brand: item?.projects?.title||item?.project_title||"—",
      requestedAt: item?.reviewed_at||item?.created_at||null,
    }));
  }, [completedProjects, completedIds]);

  const completedDisplayRows = useMemo(() => {
    const merged = new Map();
    for (const item of completedProjects) {
      const wf = String(item?.workflow_status||"").toUpperCase();
      const payout = String(item?.payout_status||"").toUpperCase();
      const hasArtifact = Boolean(item?.proof_status)||Boolean(item?.review_status);
      const hasPayout   = Boolean(payout);
      const showByWF = wf ? ["SUBMITTED","APPROVED","COMPLETED"].includes(wf) : true;
      if (!showByWF || (!hasArtifact && !hasPayout)) continue;
      const key = item?.id || `${item?.project_id||"na"}::${item?.product_id||"na"}::c`;
      if (!merged.has(key)) merged.set(key, item);
    }
    return Array.from(merged.values()).sort((a,b) =>
      new Date(b?.completed_at||b?.reviewed_at||b?.created_at||0) -
      new Date(a?.completed_at||a?.reviewed_at||a?.created_at||0)
    );
  }, [completedProjects]);

  const getCompletedStatus = (item) => {
    const wf = String(item?.workflow_status||"").toUpperCase();
    if (wf) return wf;
    return String(item?.payout_status||"").toUpperCase()==="PAID" ? "COMPLETED" : "PENDING_PAYMENT";
  };

  const activeTabCount = useMemo(() =>
    activeProjects.filter((i) => Boolean(String((i?.selected_product||i?.project_products)?.name||"").trim())).length,
    [activeProjects]
  );

  const tabs = [
    { key:"catalog",   label:"Browse Products", count: filteredCatalog.length     },
    { key:"approved",  label:"Approved",         count: approvedRows.length        },
    { key:"cancelled", label:"Cancelled",        count: cancelledRows.length       },
    { key:"applied",   label:"Applied",          count: appliedRows.length         },
    { key:"completed", label:"Completed",        count: completedDisplayRows.length},
    { key:"payouts",   label:"My Payouts",       count: myPayouts.length           },
  ];

  /* ── send product request ── */
  const sendRequest = async () => {
    const token = getStoredToken();
    if (!token || !selectedProducts.length) return;
    setSendingReq(true);
    addToast(`Sending ${selectedProducts.length} request(s) to admin…`, "info");
    try {
      const results = await Promise.allSettled(
        selectedProducts.map((item) =>
          fetchJson(`/projects/${item.project_id}/apply`, token, {
            method: "POST", headers: { "Content-Type":"application/json" },
            body: JSON.stringify({ productId: item.id||item.product_id, quantity: quantities[item.selection_key]||1 }),
          })
        )
      );
      const ok  = results.filter((r) => r.status==="fulfilled" && r.value?.success && !r.value?.alreadyPending).length;
      const dup = results.filter((r) => r.status==="fulfilled" && r.value?.alreadyPending).length;
      const fail= results.filter((r) => r.status==="rejected").length;
      if (ok   > 0) { const r = await fetchJson("/projects/applied", token); setAppliedProjects(Array.isArray(r?.data)?r.data:[]); addToast(`🎉 ${ok} request(s) submitted! Admin will review soon.`, "success"); }
      if (dup  > 0) addToast(`⏳ ${dup} product(s) already waiting for approval.`, "warning");
      if (fail > 0) addToast(`❌ ${fail} request(s) could not be submitted.`, "error");
      setSelectedKeys([]);
    } catch (err) { addToast(err.message||"Unable to submit request.", "error"); }
    finally { setSendingReq(false); }
  };

  /* ── tasks derived ── */
  const ACTIVE_STATUSES = ["RESERVED","PURCHASED"];
  const activeAllocations = useMemo(() =>
    allocations.filter((r) => ACTIVE_STATUSES.includes(String(r?.status||"").toUpperCase())),
    [allocations]
  );
  const taskProducts = useMemo(() => {
    const all = [];
    for (const alloc of activeAllocations) {
      const prods = Array.isArray(alloc.selected_products) ? alloc.selected_products : [];
      prods.forEach((p) => all.push({ ...p, _allocationId: alloc.id }));
    }
    return all;
  }, [activeAllocations]);

  const isPurchaseConfirmed = useMemo(() => {
    if (!activeAllocations.length) return false;
    return activeAllocations.every((alloc) =>
      Boolean(purchased[alloc.id]) ||
      ["PURCHASED","COMPLETED"].includes(String(alloc?.status||"").toUpperCase()) ||
      (Array.isArray(alloc.selected_products) && alloc.selected_products.some((p) => proofDone(p.purchase_proof)))
    );
  }, [activeAllocations, purchased]);

  const allInvDone = taskProducts.length > 0 && taskProducts.every((p) => proofDone(p.purchase_proof));
  const allRevDone = taskProducts.length > 0 && taskProducts.every((p) => reviewDone(p.review_submission));
  const allApproved = taskProducts.length > 0 && taskProducts.every(
    (p) => statusOf(p.purchase_proof)==="APPROVED" && statusOf(p.review_submission)==="APPROVED"
  );
  const anyUploaded = taskProducts.some((p) => proofDone(p.purchase_proof)||reviewDone(p.review_submission));
  const totalValue  = taskProducts.reduce((s,p) => s+Number(p?.product_value||0), 0);

  const projectName = useMemo(() => {
    const names = new Set(taskProducts.map((p) => String(p?.project_title||"").trim()).filter(Boolean));
    if (names.size > 1) return "Multiple campaigns";
    if (names.size === 1) return Array.from(names)[0];
    return activeAllocations[0]?.projects?.title || "Campaign";
  }, [taskProducts, activeAllocations]);

  const taskStatus = String(activeAllocations[0]?.status||"RESERVED").toUpperCase();
  const chipColor  = (s) => ({APPROVED:"#22c55e",PENDING:"#f59e0b",REJECTED:"#ef4444",SUBMITTED:"#3b82f6",
    COMPLETED:"#10b981",PURCHASED:"#06b6d4",RESERVED:"#06b6d4",EXPIRED:"#f97316",CANCELLED:"#e74c3c"}[s]||"#94a3b8");

  const timeLeft = useMemo(() => {
    void tick;
    const deadlines = activeAllocations.map((a) => a.reserved_until).filter(Boolean).map((d) => new Date(d).getTime());
    if (!deadlines.length) return { d:0,h:0,m:0,s:0 };
    let diff = Math.max(0, Math.min(...deadlines) - Date.now());
    const d=Math.floor(diff/864e5); diff-=d*864e5;
    const h=Math.floor(diff/36e5);  diff-=h*36e5;
    const m=Math.floor(diff/6e4);   diff-=m*6e4;
    const s=Math.floor(diff/1e3);
    return {d,h,m,s};
  }, [activeAllocations, tick]);

  const taskHistory = useMemo(() => {
    const rows = [];
    for (const alloc of activeAllocations) {
      (Array.isArray(alloc.selected_products) ? alloc.selected_products : [null]).forEach((p, i) => {
        const proof  = p?.purchase_proof    || (p===null ? alloc?.purchase_proof    : null);
        const review = p?.review_submission || (p===null ? alloc?.review_submission : null);
        const pname  = p?.product_name ? ` · ${p.product_name}` : "";
        if (proof?.created_at)  rows.push({ key:`proof-${alloc.id}-${i}`,  at:proof.created_at,  label:`Invoice Uploaded${pname}`,   status:statusOf(proof) });
        if (review?.created_at) rows.push({ key:`review-${alloc.id}-${i}`, at:review.created_at, label:`Review Submitted${pname}`,   status:statusOf(review) });
      });
    }
    return rows.sort((a,b) => new Date(b.at)-new Date(a.at));
  }, [activeAllocations]);

  const panelProduct = taskPanel ? taskProducts.find((p) => p.product_id===taskPanel.prodId)||null : null;

  const confirmPurchase = async () => {
    if (savingPurch) return;
    setSavingPurch(true);
    try {
      for (const alloc of activeAllocations) {
        setPurchased((prev) => ({ ...prev, [alloc.id]:true }));
        await updateAllocationStatus(alloc.id, "PURCHASED");
        setAllocations((prev) => prev.map((r) => r.id===alloc.id ? {...r, status:"PURCHASED"} : r));
      }
    } catch (err) { addToast(err.response?.data?.message||"Could not update status.", "error"); }
    finally { setSavingPurch(false); }
  };

  const handleCancel = async () => {
    if (!activeAllocations.length) { setCancelError("Could not find your allocation."); return; }
    setCancelBusy(true); setCancelError("");
    try {
      for (const alloc of activeAllocations) await cancelAllocation(alloc.id);
      setShowCancel(false); setCancelBusy(false);
      setView("participant"); setActiveTab("catalog");
      await loadAll();
    } catch (err) { setCancelError(err?.response?.data?.message||err?.message||"Failed to cancel."); setCancelBusy(false); }
  };

  const handleConfirmSubmit = async () => {
    setConfirmBusy(true);
    await new Promise((res) => setTimeout(res, 1200));
    setConfirmBusy(false); setShowConfirm(false);
    addToast("All submissions sent to admin for review!", "success");
    // Refresh payouts in background
    const token = getStoredToken();
    if (token) {
      try {
        const pr = await fetchJson("/admin/payouts/my", token);
        if (Array.isArray(pr?.data)) setMyPayouts(pr.data);
      } catch { /* non-critical */ }
    }
  };

  const ProjBadge = ({ status }) => {
    const s = String(status||"").toUpperCase();
    const cls = s==="PUBLISHED" ? "sa-status-badge--published" : s==="ARCHIVED" ? "sa-status-badge--archived" : "sa-status-badge--draft";
    return <span className={`sa-status-badge sa-status-badge--sm ${cls}`}>{status||"—"}</span>;
  };

  /* ── loading ── */
  if (loading) return (
    <div className="nd-loading-screen">
      <div className="nd-loading-spinner" />
      <p>Loading dashboard…</p>
    </div>
  );

  const displayName = user?.full_name?.trim()?.split(" ")[0] || user?.email?.split("@")[0] || "Admin";

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="sa-dashboard">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── Confirm Submit Modal ── */}
      {showConfirm && (
        <div className="ma-modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="ma-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ma-modal-icon">🎉</div>
            <h2 className="ma-modal-title">Everything looks correct?</h2>
            <p className="ma-modal-sub">Once confirmed, submissions will be sent to admin for approval.</p>
            <div className="ma-modal-list">
              {taskProducts.map((p, i) => (
                <div key={p.product_id||i} className="ma-modal-prod-row">
                  <div className="ma-modal-prod-name">{p.product_name||"Product"}</div>
                  <div className="ma-modal-prod-checks">
                    <span className={`ma-modal-check ${proofDone(p.purchase_proof)?"ok":"missing"}`}>
                      {proofDone(p.purchase_proof)?"✓":"✗"} Invoice
                    </span>
                    <span className={`ma-modal-check ${reviewDone(p.review_submission)?"ok":"missing"}`}>
                      {reviewDone(p.review_submission)?"✓":"✗"} Review
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="ma-modal-actions">
              <button type="button" className="ma-modal-btn-secondary" onClick={() => setShowConfirm(false)} disabled={confirmBusy}>← Go Back</button>
              <button type="button" className="ma-modal-btn-primary" onClick={handleConfirmSubmit} disabled={confirmBusy}>
                {confirmBusy ? "Submitting…" : "Confirm & Submit to Admin →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Modal ── */}
      {showCancel && (
        <div className="ma-modal-overlay" onClick={() => setShowCancel(false)}>
          <div className="ma-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ma-modal-icon" style={{ fontSize:"2.2rem" }}>⚠️</div>
            <h2 className="ma-modal-title">Cancel Reservation?</h2>
            <p className="ma-modal-sub">Your slot will be released and the budget returned to the project pool.</p>
            {cancelError && <div style={{ color:"#c0392b", background:"#fff0f0", border:"1px solid #e74c3c", borderRadius:8, padding:"8px 12px", marginBottom:10, fontSize:13 }}>{cancelError}</div>}
            <div className="ma-modal-actions">
              <button type="button" className="ma-modal-btn-secondary" onClick={() => setShowCancel(false)} disabled={cancelBusy}>← Keep Reservation</button>
              <button type="button" onClick={handleCancel} disabled={cancelBusy}
                style={{ padding:"12px 28px", borderRadius:10, fontWeight:700, fontSize:15, border:"none", cursor:cancelBusy?"not-allowed":"pointer",
                  background:cancelBusy?"#ccc":"linear-gradient(135deg,#e74c3c,#c0392b)", color:"#fff", opacity:cancelBusy?0.6:1 }}>
                {cancelBusy ? "Cancelling…" : "Yes, Cancel Reservation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ TOPBAR ══════════════════════ */}
      <header className="sa-topbar">
        <button type="button" className="sa-menu-btn" onClick={() => setSidebar((o) => !o)}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        </button>
        <div className="sa-brand"><span className="sa-brand-n">N</span>ITRO</div>

        {/* View switcher */}
        <div style={{ display:"flex", gap:4, background:"var(--bg-3)", borderRadius:10, padding:4, marginLeft:16 }}>
          {[
            { key:"admin",       label:"Admin" },
            { key:"participant", label:"Marketplace", badge: (appliedRows.length+approvedRows.length)||null },
            { key:"tasks",       label:"My Tasks",    badge: taskProducts.filter((p)=>!proofDone(p.purchase_proof)||!reviewDone(p.review_submission)).length||null },
          ].map(({ key, label, badge }) => (
            <button key={key} type="button"
              onClick={() => { setView(key); if (key==="participant") setActiveTab("catalog"); }}
              style={{
                position:"relative", display:"flex", alignItems:"center", gap:6,
                padding:"7px 16px", borderRadius:7, border:"none", cursor:"pointer",
                fontSize:"0.82rem", fontWeight:600,
                background: view===key ? "var(--accent)" : "transparent",
                color:      view===key ? "#fff" : "var(--text-3)",
                transition: "all 0.15s",
              }}>
              {label}
              {badge > 0 && (
                <span style={{ position:"absolute", top:2, right:2, background:"#ef4444", color:"#fff",
                  borderRadius:"50%", width:16, height:16, fontSize:"0.65rem", fontWeight:800,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>{badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search — context-aware */}
        {view === "admin" && (
          <div className="sa-search-wrap" style={{ flex:1 }}>
            <span className="sa-search-icon"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg></span>
            <input className="sa-search" placeholder="Search projects…" value={adminQuery} onChange={(e) => setAdminQuery(e.target.value)} />
          </div>
        )}
        {view === "participant" && activeTab === "catalog" && (
          <div style={{ flex:1 }} />
        )}
        {(view === "tasks" || (view==="participant" && activeTab!=="catalog")) && (
          <div style={{ flex:1 }} />
        )}

        <div className="sa-topbar-right">
          <div className="sa-user-pill">
            <div className="sa-user-avatar">{initials(user?.full_name)}</div>
            <div className="sa-user-info">
              <span className="sa-user-name">{user?.full_name||"Admin"}</span>
              <span className="sa-user-role">{user?.role==="SUPER_ADMIN" ? "Super Admin" : "Admin"}</span>
            </div>
          </div>
          <button type="button" className="sa-logout" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="sa-layout">
        {sidebarOpen && <button type="button" className="sa-backdrop" onClick={() => setSidebar(false)} />}

        {/* ══════════════════════ SIDEBAR ══════════════════════ */}
        <aside className={`sa-sidebar${sidebarOpen ? " sa-sidebar--open" : ""}`}>
          <nav className="sa-nav">
            {[
              { key:"dashboard",      label:"Dashboard",             path: null,                   active: view==="admin" },
              { key:"create",         label:"Create Project",        path: "/projects/create"      },
              { key:"manage",         label:"View All Projects",     path: "/projects/manage"      },
              { key:"applications",   label:"Application Approvals", path: "/admin/applications"   },
              { key:"client-budgets", label:"Client Budgets",        path: "/admin/client-budgets" },
              { key:"payouts",        label:"Payouts",               path: "/admin/payouts"        },
              { key:"payout-history", label:"Payout History",        path: "/admin/payout-history" },
            ].map(({ key, label, path, active }) => (
              <button key={key} type="button"
                className={`sa-nav-item${active ? " sa-nav-item--active" : ""}`}
                onClick={() => { setSidebar(false); if (path) navigate(path); else setView("admin"); }}>
                <span className="sa-nav-label">{label}</span>
              </button>
            ))}
            <div style={{ height:1, background:"var(--border)", margin:"12px 16px" }} />
            <button type="button" className={`sa-nav-item${view==="participant"?" sa-nav-item--active":""}`}
              onClick={() => { setSidebar(false); setView("participant"); setActiveTab("catalog"); }}>
              <span className="sa-nav-label">🛍 Marketplace</span>
            </button>
            <button type="button" className={`sa-nav-item${view==="tasks"?" sa-nav-item--active":""}`}
              onClick={() => { setSidebar(false); setView("tasks"); }}>
              <span className="sa-nav-label">📋 My Tasks
                {taskProducts.filter((p)=>!proofDone(p.purchase_proof)||!reviewDone(p.review_submission)).length > 0 && (
                  <span style={{ marginLeft:8, background:"#ef4444", color:"#fff", borderRadius:10, padding:"1px 7px", fontSize:"0.7rem", fontWeight:800 }}>
                    {taskProducts.filter((p)=>!proofDone(p.purchase_proof)||!reviewDone(p.review_submission)).length}
                  </span>
                )}
              </span>
            </button>
          </nav>
          <button type="button" className="sa-new-project-btn" onClick={() => { setSidebar(false); navigate("/projects/create"); }}>
            + New Project
          </button>
        </aside>

        {/* ══════════════════════ MAIN ══════════════════════ */}
        <main className="sa-main">

          {/* ══════════════════════════════════════════
              VIEW: ADMIN
          ══════════════════════════════════════════ */}
          {view === "admin" && (
            <>
              <div className="sa-page-head">
                <div>
                  <h1 className="sa-page-title">Project <span className="sa-highlight">Dashboard</span></h1>
                  <p className="sa-page-sub">Manage projects, track payouts and pending actions.</p>
                </div>
                <div className="sa-page-actions">
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ background:"var(--bg-3)", border:"1px solid var(--border-light)", color:"var(--text)", borderRadius:8, padding:"8px 12px", fontSize:"0.85rem", cursor:"pointer" }}>
                    <option value="ALL">All Status</option>
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                  <button type="button" className="sa-export-btn" onClick={loadAll}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    &nbsp;Refresh
                  </button>
                </div>
              </div>

              {/* Stat cards */}
              <div className="sa-cards">
                {[
                  { label:"My Projects",      value:fmtNum(myProjects.length),                     note:"Created by you", color:"blue"  },
                  { label:"Eligible Payouts", value:fmtNum(summary?.payouts_eligible||0),           note:"Awaiting batch", color:"green" },
                  { label:"Pending Proofs",   value:fmtNum(summary?.purchase_proofs_pending||0),    note:"Need review",    color:"amber" },
                  { label:"Published",        value:fmtNum(publishedCount),                         note:`${draftCount} drafts`, color:"cyan" },
                ].map((c) => (
                  <article key={c.label} className={`sa-stat-card sa-stat-card--${c.color}`}>
                    <div className="sa-stat-card-top">
                      <span className={`sa-stat-note sa-stat-note--${c.color}`}>{c.note}</span>
                    </div>
                    <div className="sa-stat-label">{c.label}</div>
                    <div className="sa-stat-value">{c.value}</div>
                  </article>
                ))}
              </div>

              {/* My Projects */}
              <div className="sa-panel sa-panel--table" style={{ marginTop:24 }}>
                <div className="sa-panel-head">
                  <div>
                    <div className="sa-panel-title">My Projects</div>
                    <div className="sa-panel-sub">{myProjects.length} created by you</div>
                  </div>
                  <button type="button" className="sa-export-btn" onClick={() => navigate("/projects/create")}>+ New Project</button>
                </div>
                <div className="sa-table-wrap">
                  <table className="sa-table">
                    <thead><tr><th>Project Name</th><th>Mode</th><th>Status</th><th>Created</th></tr></thead>
                    <tbody>
                      {myProjects.length ? myProjects.slice(0,8).map((p) => (
                        <tr key={p.id} className="sa-table-row--clickable" onClick={() => navigate(`/projects/${p.id}`)} style={{ cursor:"pointer" }}>
                          <td className="sa-td-main">{p.title||p.name||"Untitled"}</td>
                          <td><span className="sa-mode-badge sa-mode-badge--d2c">{p.mode||"—"}</span></td>
                          <td><ProjBadge status={p.status} /></td>
                          <td className="sa-td-muted">{fmtDate(p.created_at)}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4} style={{ textAlign:"center", padding:"32px 0", color:"var(--text-3)" }}>No projects created by you yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* All Projects */}
              <div className="sa-panel sa-panel--table" style={{ marginTop:20, marginBottom:32 }}>
                <div className="sa-panel-head">
                  <div>
                    <div className="sa-panel-title">All Projects Overview</div>
                    <div className="sa-panel-sub">{filteredProjects.length} projects</div>
                  </div>
                </div>
                <div className="sa-table-wrap">
                  <table className="sa-table">
                    <thead><tr><th>Project Name</th><th>Created By</th><th>Mode</th><th>Status</th><th>Created</th></tr></thead>
                    <tbody>
                      {filteredProjects.length ? filteredProjects.slice(0,20).map((p) => (
                        <tr key={p.id} className="sa-table-row--clickable" onClick={() => navigate(`/projects/${p.id}`)} style={{ cursor:"pointer" }}>
                          <td className="sa-td-main">{p.title||p.name||"Untitled"}</td>
                          <td className="sa-td-muted" style={{ fontSize:"0.78rem" }}>
                            {p.created_by===user?.id ? <span style={{ color:"var(--cyan)", fontWeight:600 }}>You</span> : String(p.created_by||"—").slice(0,8)+"…"}
                          </td>
                          <td><span className="sa-mode-badge sa-mode-badge--d2c">{p.mode||"—"}</span></td>
                          <td><ProjBadge status={p.status} /></td>
                          <td className="sa-td-muted">{fmtDate(p.created_at)}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} style={{ textAlign:"center", padding:"32px 0", color:"var(--text-3)" }}>No matching projects found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════
              VIEW: PARTICIPANT MARKETPLACE
              (exact same layout as participant dashboard)
          ══════════════════════════════════════════ */}
          {view === "participant" && (
            <div className="nd-dashboard" style={{ minHeight:"unset", background:"transparent" }}>

              {/* Hero */}
              <section className="nd-hero">
                <div className="nd-hero-left">
                  <h1 className="nd-hero-title">Welcome back, {displayName}!</h1>
                  <p className="nd-hero-sub">
                    {activeTabCount > 0
                      ? `You have ${activeTabCount} active project${activeTabCount!==1?"s":""} in progress.`
                      : "Browse products below and select ones you'd like to review."}
                  </p>
                </div>
                <div className="nd-hero-stats">
                  <div className="nd-stat-card"><span className="nd-stat-num">{activeTabCount}</span><span className="nd-stat-label">Active</span></div>
                  <div className="nd-stat-card"><span className="nd-stat-num">{appliedRows.length}</span><span className="nd-stat-label">Applied</span></div>
                  <div className="nd-stat-card"><span className="nd-stat-num">{completedDisplayRows.length}</span><span className="nd-stat-label">Done</span></div>
                </div>
              </section>

              {/* Tab bar */}
              <div className="nd-tab-bar">
                <div className="nd-tabs" role="tablist">
                  {tabs.map((tab) => (
                    <button key={tab.key} type="button" role="tab"
                      aria-selected={activeTab===tab.key}
                      className={`nd-tab ${activeTab===tab.key ? "nd-tab--active" : ""}`}
                      onClick={() => setActiveTab(tab.key)}>
                      {tab.label}
                      {tab.count > 0 && <span className="nd-tab-count">{tab.count}</span>}
                    </button>
                  ))}
                </div>
                {activeTab === "catalog" && (
                  <div className="nd-filter-row">
                    <label htmlFor="nd-brand-filter" className="nd-filter-label">Brand:</label>
                    <select id="nd-brand-filter" className="nd-filter-select" value={clientFilter}
                      onChange={(e) => setClientFilter(e.target.value)}>
                      <option value="ALL">All Brands</option>
                      {clientOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <span className="nd-filter-count">{filteredCatalog.length} product{filteredCatalog.length!==1?"s":""}</span>
                  </div>
                )}
              </div>

              {/* TAB: Browse Products */}
              {activeTab === "catalog" && (
                <div className="nd-tab-content">
                  {filteredCatalog.length === 0 ? (
                    <EmptyState icon="📦" title="No products available" subtitle="New campaigns are added regularly. Check back soon!" />
                  ) : (
                    <div className="nd-product-grid">
                      {filteredCatalog.map((item) => (
                        <ProductCard
                          key={item.selection_key||item.id}
                          item={item}
                          isSelected={selectedKeys.includes(item.selection_key)}
                          latestApp={getLatestApp(allAppRows, item.id)}
                          completedIds={completedIds}
                          onSelect={(key) => setSelectedKeys((prev) => prev.includes(key) ? prev.filter((k)=>k!==key) : [...prev, key])}
                          onNavigate={() => setView("tasks")}
                          addToast={addToast}
                          quantity={quantities[item.selection_key]||1}
                          onQtyChange={(qty) => {
                            setQuantities((prev) => ({ ...prev, [item.selection_key]:qty }));
                            if (qty > 1 && !selectedKeys.includes(item.selection_key))
                              setSelectedKeys((prev) => [...prev, item.selection_key]);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Approved */}
              {activeTab === "approved" && (
                <div className="nd-tab-content">
                  {approvedRows.length === 0 ? (
                    <EmptyState icon="✅" title="No approved requests yet" subtitle="Once admin approves your product requests, they appear here with action steps." />
                  ) : (
                    <div className="nd-list-cards">
                      {approvedRows.map((row) => (
                        <div key={row.id} className="nd-list-card nd-list-card--approved">
                          <div className="nd-list-card-icon">✓</div>
                          <div className="nd-list-card-body">
                            <h4>{row.productName}</h4>
                            <span className="nd-list-card-project">{row.brand||"—"}</span>
                            <span className="nd-list-card-date">Approved {fmtDate(row.requestedAt)}</span>
                          </div>
                          <StatusBadge status={row.badgeStatus||"APPROVED"} />
                          <div className="nd-list-card-action">
                            <button type="button" className="nd-btn nd-btn--task"
                              onClick={() => { setView("tasks"); addToast("Opening your task — submit your invoice and review there.", "info"); }}>
                              Submit Invoice &amp; Review →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Cancelled */}
              {activeTab === "cancelled" && (
                <div className="nd-tab-content">
                  {cancelledRows.length === 0 ? (
                    <EmptyState icon="✕" title="No cancelled products" subtitle="Cancelled allocations will appear here." />
                  ) : (
                    <div className="nd-list-cards">
                      {cancelledRows.map((item) => (
                        <div key={item.id} className="nd-list-card nd-list-card--rejected">
                          <div className="nd-list-card-icon">✕</div>
                          <div className="nd-list-card-body">
                            <h4>{item?.project_products?.name||item?.product_name||"—"}</h4>
                            <span className="nd-list-card-project">{item?.projects?.title||"—"}</span>
                            <span className="nd-list-card-date">Cancelled {fmtDate(item?.allocation?.updated_at||item?.updated_at||item?.created_at)}</span>
                          </div>
                          <StatusBadge status="CANCELLED" />
                          <div className="nd-list-card-action">
                            <button type="button" className="nd-btn nd-btn--select"
                              onClick={() => setActiveTab("catalog")}>
                              Reapply from Browse
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Applied */}
              {activeTab === "applied" && (
                <div className="nd-tab-content">
                  {appliedRows.length === 0 ? (
                    <EmptyState icon="📋" title="No pending applications" subtitle="Select products from Browse and send a request — they'll appear here while admin reviews." />
                  ) : (
                    <div className="nd-list-cards">
                      {appliedRows.map((item) => {
                        const s = String(item?.status||"").toUpperCase();
                        return (
                          <div key={item.id} className={`nd-list-card nd-list-card--${s==="REJECTED"?"rejected":"pending"}`}>
                            <div className="nd-list-card-icon">{s==="REJECTED"?"✕":"⏳"}</div>
                            <div className="nd-list-card-body">
                              <h4>{item?.project_products?.name||"—"}</h4>
                              <span className="nd-list-card-project">{item?.projects?.title||"—"}</span>
                              <span className="nd-list-card-date">Applied {fmtDate(item?.created_at)}</span>
                            </div>
                            <StatusBadge status={s} />
                            <div className="nd-list-card-action">
                              {s==="REJECTED" ? (
                                <button type="button" className="nd-btn nd-btn--select" onClick={() => setActiveTab("catalog")}>
                                  Request Again
                                </button>
                              ) : (
                                <span className="nd-chip nd-chip--waiting">Awaiting Review</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Completed */}
              {activeTab === "completed" && (
                <div className="nd-tab-content">
                  {completedDisplayRows.length === 0 ? (
                    <EmptyState icon="★" title="No completed campaigns yet" subtitle="Complete your tasks and reviews — finished campaigns show up here." />
                  ) : (
                    <div className="nd-list-cards">
                      {completedDisplayRows.map((item) => (
                        <div key={item.id} className="nd-list-card nd-list-card--completed">
                          <div className="nd-list-card-icon">★</div>
                          <div className="nd-list-card-body">
                            <h4>{item?.project_products?.name||item?.name||"—"}</h4>
                            <span className="nd-list-card-project">{item?.projects?.title||item?.project_title||"—"}</span>
                            <span className="nd-list-card-date">
                              {getCompletedStatus(item)==="SUBMITTED" ? "Invoice/review submitted " :
                               getCompletedStatus(item)==="APPROVED"  ? "Admin approved, payout pending since " : "Completed "}
                              {fmtDate(item?.completed_at||item?.payout_created_at||item?.reviewed_at||item?.updated_at)}
                            </span>
                          </div>
                          <StatusBadge status={getCompletedStatus(item)} />
                          <div className="nd-list-card-action">
                            {(item?.project_products?.product_value??item?.allocated_budget) ? (
                              <span className="nd-chip nd-chip--reward">{fmtInr(item?.project_products?.product_value??item?.allocated_budget)} value</span>
                            ) : (
                              <span className="nd-chip nd-chip--done">Campaign complete</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: My Payouts */}
              {activeTab === "payouts" && (
                <div className="nd-tab-content">
                  {myPayouts.length === 0 ? (
                    <EmptyState icon="💰" title="No payouts yet" subtitle="Complete your tasks and reviews to earn reimbursements. They will appear here." />
                  ) : (
                    <div className="nd-list-cards">
                      {myPayouts.map((p) => {
                        const s = String(p?.status || "").toUpperCase();
                        const isPaid      = s === "PAID";
                        const isInBatch   = s === "IN_BATCH" || s === "EXPORTED";
                        const isEligible  = s === "ELIGIBLE";
                        const iconEmoji   = isPaid ? "💸" : isInBatch ? "📦" : isEligible ? "✅" : "⏳";
                        const cardCls     = isPaid ? "nd-list-card--completed" : isInBatch ? "nd-list-card--approved" : "nd-list-card--pending";
                        const statusLabel = isPaid ? "COMPLETED" : isInBatch ? "APPROVED" : "PENDING";
                        const campaignName = p?.projects?.title || p?.projects?.name || "—";
                        const productName  = p?.project_products?.name || p?.product_name || "—";
                        const qty          = Number(p?.quantity || 1);
                        const unitPrice    = Number(p?.unit_price || 0);
                        const displayAmt   = Number(p?.total_amount || p?.product_amount || p?.amount || 0);
                        const amount = new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:2 }).format(displayAmt);
                        return (
                          <div key={p.id} className={`nd-list-card ${cardCls}`}>
                            <div className="nd-list-card-icon">{iconEmoji}</div>
                            <div className="nd-list-card-body">
                              <h4>{campaignName}</h4>
                              <span className="nd-list-card-project">{productName}</span>
                              <span className="nd-list-card-date">
                                {isPaid ? "Paid on " : isInBatch ? "In batch since " : isEligible ? "Eligible since " : "Created "}
                                {fmtDate(p?.paid_at || p?.created_at)}
                              </span>
                            </div>
                            <StatusBadge status={statusLabel} />
                            <div className="nd-list-card-action">
                              <div style={{ textAlign: "right" }}>
                                <span className={`nd-chip ${isPaid ? "nd-chip--reward" : "nd-chip--waiting"}`}>
                                  {amount}
                                </span>
                                {qty > 1 && (
                                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                                    {new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(unitPrice)} × {qty} units
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {/* Total summary */}
                      <div style={{
                        marginTop: 16, padding: "16px 20px", borderRadius: 12,
                        background: "var(--bg-card)", border: "1px solid var(--border)",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                        <div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4 }}>Total Earned</div>
                          <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--success)" }}>
                            {new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:2 })
                              .format(myPayouts.filter((p) => String(p?.status||"").toUpperCase()==="PAID").reduce((s,p) => s+Number(p?.total_amount||p?.product_amount||p?.amount||0), 0))}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-faint)", marginTop: 2 }}>
                            from {myPayouts.filter((p) => String(p?.status||"").toUpperCase()==="PAID").length} paid payout{myPayouts.filter((p) => String(p?.status||"").toUpperCase()==="PAID").length!==1?"s":""}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4 }}>Pending Payout</div>
                          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--warning)" }}>
                            {new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:2 })
                              .format(myPayouts.filter((p) => !["PAID"].includes(String(p?.status||"").toUpperCase())).reduce((s,p) => s+Number(p?.total_amount||p?.product_amount||p?.amount||0), 0))}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-faint)", marginTop: 2 }}>
                            {myPayouts.filter((p) => !["PAID"].includes(String(p?.status||"").toUpperCase())).length} pending
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fixed selection bar */}
              {activeTab === "catalog" && selectedProducts.length > 0 && (
                <div className="nd-selection-bar">
                  <div className="nd-selection-info">
                    <span className="nd-selection-count">{selectedProducts.length}</span>
                    <div>
                      <strong>{selectedProducts.length} product{selectedProducts.length!==1?"s":""} selected</strong>
                      <small>Ready to send for admin approval</small>
                    </div>
                  </div>
                  <div className="nd-selection-actions">
                    <button type="button" className="nd-btn nd-btn--ghost"
                      onClick={() => { setSelectedKeys([]); addToast("Selection cleared.", "info"); }}>
                      Clear
                    </button>
                    <button type="button" className="nd-btn nd-btn--send" disabled={sendingReq} onClick={sendRequest}>
                      {sendingReq ? "Sending..." : "Send Request to Admin →"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              VIEW: MY TASKS
              (exact same layout as MyAllocations page)
          ══════════════════════════════════════════ */}
          {view === "tasks" && (
            <div className="ma-page" style={{ background:"transparent", minHeight:"unset" }}>
              <div className="ma-page-head">
                <div>
                  <h1>My Tasks</h1>
                  <p>Complete each step to earn your reimbursement.</p>
                </div>
                <button type="button" onClick={loadAll} className="sa-export-btn">↻ Refresh</button>
              </div>

              {taskProducts.length === 0 && myPayouts.length === 0 && (
                <div className="ma-empty">
                  <div className="ma-empty-icon">📭</div>
                  <strong>No active tasks yet</strong>
                  <p>Head to the Marketplace to browse campaigns and send product requests.</p>
                  <button type="button" onClick={() => { setView("participant"); setActiveTab("catalog"); }}>Go to Marketplace</button>
                </div>
              )}
              {taskProducts.length === 0 && myPayouts.length > 0 && (
                <div className="ma-empty" style={{ marginBottom: 24 }}>
                  <div className="ma-empty-icon">✅</div>
                  <strong>All tasks complete!</strong>
                  <p>Your submissions are under review. Check your payout status below.</p>
                </div>
              )}

              {taskProducts.length > 0 && (
                <div className="ma-layout">
                  {/* Sidebar */}
                  <aside className="ma-sidebar">
                    <div className="ma-panel">
                      <div className="ma-panel-label">📋 Campaign</div>
                      <div className="ma-campaign-name">{projectName}</div>
                      <span className="ma-status-chip" style={{ background:`${chipColor(taskStatus)}22`, color:chipColor(taskStatus), border:`1px solid ${chipColor(taskStatus)}55` }}>
                        {taskStatus}
                      </span>
                    </div>
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
                    <div className="ma-panel">
                      <div className="ma-panel-label">💰 Estimated Payout</div>
                      <div className="ma-payout-amt">{fmtInr(totalValue)}</div>
                      <div className="ma-payout-note">Reimbursement after approval</div>
                    </div>
                    <div className="ma-panel">
                      <div className="ma-panel-label">📌 Steps Overview</div>
                      <div className="ma-steps-list">
                        {[
                          ["Reservation Confirmed", true],
                          ["Purchase Products",     isPurchaseConfirmed],
                          ["Upload Invoices",       allInvDone],
                          ["Submit Reviews",        allRevDone],
                        ].map(([label, done]) => (
                          <div key={label} className={`ma-step-item ${done?"done":""}`}>
                            <span className="ma-step-dot">{done?"✓":"○"}</span>
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {["RESERVED","PURCHASED"].includes(taskStatus) && (
                      <div className="ma-panel" style={{ marginTop:8 }}>
                        <div className="ma-panel-label" style={{ color:"#e74c3c" }}>⚠️ Cancel Reservation</div>
                        <p style={{ fontSize:13, color:"#9aa3b2", lineHeight:1.5, margin:"8px 0 12px" }}>
                          Changed your mind? Cancel before completing your tasks.
                        </p>
                        {cancelError && <div style={{ fontSize:13, color:"#c0392b", background:"#fff0f0", border:"1px solid #e74c3c", borderRadius:8, padding:"8px 12px", marginBottom:10 }}>{cancelError}</div>}
                        <button type="button" onClick={() => { setCancelError(""); setShowCancel(true); }}
                          style={{ width:"100%", padding:"10px 16px", borderRadius:8, fontWeight:700, fontSize:13, cursor:"pointer",
                            background:"transparent", color:"#e74c3c", border:"1.5px solid #e74c3c" }}>
                          Cancel Reservation →
                        </button>
                      </div>
                    )}
                  </aside>

                  {/* Content */}
                  <div className="ma-content">
                    {/* Step 1: Confirm Purchase */}
                    {!isPurchaseConfirmed && (
                      <div className="ma-card ma-card-active">
                        <div className="ma-card-step-num">Step 1</div>
                        <h2 className="ma-card-title">Confirm Your Purchase</h2>
                        <p className="ma-card-sub">Buy all approved products using your own account, then confirm below.</p>
                        {taskProducts.length > 0 && (
                          <div className="ma-product-list">
                            <div className="ma-product-list-label">Products to buy ({taskProducts.length})</div>
                            {taskProducts.map((p, i) => (
                              <div key={p.product_id||i} className="ma-product-row">
                                <div className="ma-product-row-name">
                                  <span>{p.product_name||"Product"}</span>
                                  <small style={{ display:"block", color:"#9aa3b2" }}>{p?.project_title||projectName}</small>
                                  {p.product_url && (
                                    <a href={p.product_url} target="_blank" rel="noopener noreferrer" className="ma-product-link">
                                      Buy on Store ↗
                                    </a>
                                  )}
                                </div>
                                <div className="ma-product-row-price">{fmtInr(p.product_value)}</div>
                              </div>
                            ))}
                            <div className="ma-product-total">
                              <span>Total to spend</span>
                              <strong>{fmtInr(totalValue)}</strong>
                            </div>
                          </div>
                        )}
                        <button type="button" className="ma-btn-primary" onClick={confirmPurchase} disabled={savingPurch}>
                          {savingPurch ? "Saving…" : "✓ I've Purchased All Products"}
                        </button>
                      </div>
                    )}

                    {/* Steps 2 & 3: Invoice + Review */}
                    {isPurchaseConfirmed && (
                      <div className="ma-card">
                        <div className="ma-card-step-num">Steps 2 &amp; 3</div>
                        <h2 className="ma-card-title">Upload Invoice &amp; Review — Per Product</h2>
                        <p className="ma-card-sub">Each product needs its own invoice upload and review submission.</p>

                        {allApproved ? (
                          <div style={{ marginTop:20, padding:"28px 24px", borderRadius:16,
                            background:"linear-gradient(135deg,#0d2d1a 0%,#0a1f12 100%)",
                            border:"1.5px solid #22c55e44", textAlign:"center" }}>
                            <div style={{ fontSize:"2.5rem", marginBottom:12 }}>🎉</div>
                            <h3 style={{ color:"#22c55e", fontSize:"1.25rem", fontWeight:700, marginBottom:8 }}>All Tasks Completed!</h3>
                            <p style={{ color:"#9aa3b2", fontSize:14, marginBottom:20, lineHeight:1.6 }}>
                              All your invoices and reviews have been approved.<br/>Your payout is being processed.
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="ma-per-product-grid">
                              {taskProducts.map((prod, i) => {
                                const iDone = proofDone(prod?.purchase_proof);
                                const rDone = reviewDone(prod?.review_submission);
                                const pId   = prod?.product_id||"";
                                const isPanelOpen = taskPanel?.prodId===pId;
                                return (
                                  <div key={pId||i} className={`ma-prod-card ${iDone&&rDone?"ma-prod-done":""}`}>
                                    <div className="ma-prod-num">{iDone&&rDone?"✓":i+1}</div>
                                    <div className="ma-prod-body">
                                      <div className="ma-prod-name">{prod.product_name||"Product"}</div>
                                      <div className="ma-prod-price" style={{ marginTop:-2, marginBottom:6, fontSize:12, color:"#9aa3b2" }}>
                                        {prod?.project_title||projectName}
                                      </div>
                                      <div className="ma-prod-price">{fmtInr(prod.product_value)}</div>
                                      <div className="ma-prod-steps">
                                        <div className={`ma-prod-step ${iDone?"done":"todo"}`}>
                                          <div className="ma-prod-step-icon">{iDone?"✅":"📄"}</div>
                                          <div className="ma-prod-step-info">
                                            <div className="ma-prod-step-label">Invoice Upload</div>
                                            <div className="ma-prod-step-status">
                                              {iDone ? (statusOf(prod?.purchase_proof)==="APPROVED"?"Approved ✓":"⏳ Under Review") : "Not Uploaded"}
                                            </div>
                                          </div>
                                          {!iDone && (
                                            <button type="button"
                                              className={`ma-prod-btn ${isPanelOpen&&taskPanel?.step==="invoice"?"active-btn":""}`}
                                              onClick={() => isPanelOpen&&taskPanel.step==="invoice" ? setTaskPanel(null) : setTaskPanel({ prodId:pId, step:"invoice" })}>
                                              {isPanelOpen&&taskPanel?.step==="invoice" ? "Close ✕" : "Upload Invoice →"}
                                            </button>
                                          )}
                                        </div>
                                        <div className={`ma-prod-step ${rDone?"done":iDone?"todo":"locked"}`}>
                                          <div className="ma-prod-step-icon">{rDone?"✅":iDone?"⭐":"🔒"}</div>
                                          <div className="ma-prod-step-info">
                                            <div className="ma-prod-step-label">Review Submission</div>
                                            <div className="ma-prod-step-status">
                                              {rDone ? (statusOf(prod?.review_submission)==="APPROVED"?"Approved ✓":"⏳ Under Review") :
                                               iDone ? "Ready to submit" : "Upload Invoice First"}
                                            </div>
                                          </div>
                                          {iDone && !rDone && (
                                            <button type="button"
                                              className={`ma-prod-btn ${isPanelOpen&&taskPanel?.step==="review"?"active-btn":""}`}
                                              onClick={() => isPanelOpen&&taskPanel.step==="review" ? setTaskPanel(null) : setTaskPanel({ prodId:pId, step:"review" })}>
                                              {isPanelOpen&&taskPanel?.step==="review" ? "Close ✕" : "Submit Review →"}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {taskPanel && panelProduct && (
                              <InlineTaskPanel
                                prod={panelProduct}
                                allocId={panelProduct._allocationId||activeAllocations[0]?.id}
                                step={taskPanel.step}
                                onStepChange={(s) => setTaskPanel((p) => p ? {...p, step:s} : null)}
                                onClose={() => setTaskPanel(null)}
                                onDataUpdate={setAllocations}
                              />
                            )}

                            {anyUploaded && (
                              <div className="ma-submit-all-wrap">
                                {allInvDone && allRevDone ? (
                                  <div className="ma-all-done-banner">
                                    🎉 All invoices and reviews submitted!{" "}
                                    <button type="button" className="ma-link-btn" onClick={() => setShowConfirm(true)}>
                                      Review &amp; Confirm Submission →
                                    </button>
                                  </div>
                                ) : (
                                  <div className="ma-partial-submit-banner">
                                    <span className="ma-partial-info">
                                      {taskProducts.filter((p)=>proofDone(p.purchase_proof)).length}/{taskProducts.length} invoices ·{" "}
                                      {taskProducts.filter((p)=>reviewDone(p.review_submission)).length}/{taskProducts.length} reviews submitted
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

                    {/* Submission History */}
                    <div className="ma-card">
                      <h2 className="ma-card-title">📋 Submission History</h2>
                      {taskHistory.length === 0 ? (
                        <p className="ma-empty-note">No submissions yet for this task.</p>
                      ) : (
                        <div className="ma-history-list">
                          {taskHistory.map((row) => (
                            <div key={row.key} className="ma-history-row">
                              <div className="ma-history-dot" style={{ background:chipColor(row.status) }} />
                              <div className="ma-history-info">
                                <div className="ma-history-label">{row.label}</div>
                                <div className="ma-history-time">
                                  {new Date(row.at).toLocaleString("en-IN", { dateStyle:"medium", timeStyle:"short" })}
                                </div>
                              </div>
                              <span className="ma-history-status" style={{ color:chipColor(row.status) }}>{row.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Payout History ── */}
              {myPayouts.length > 0 && (
                <div className="ma-card" style={{ marginTop: 24 }}>
                  <h2 className="ma-card-title">💰 My Payout History</h2>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.875rem" }}>
                      <thead>
                        <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                          {["Campaign","Product","Amount","Status","Date"].map((h) => (
                            <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:"0.75rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {myPayouts.map((p) => {
                          const s = String(p?.status||"").toUpperCase();
                          const col = s==="PAID"?"#22c55e":s==="IN_BATCH"||s==="EXPORTED"?"#3b82f6":s==="ELIGIBLE"?"#f59e0b":"#64748b";
                          return (
                            <tr key={p.id} style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                              <td style={{ padding:"12px 14px", color:"#e2e8f0", fontWeight:600 }}>{p?.projects?.title||p?.projects?.name||"—"}</td>
                              <td style={{ padding:"12px 14px", color:"#94a3b8", fontSize:"0.82rem" }}>
                                {p?.project_products?.name || p?.product_name || "—"}
                                {Number(p?.quantity||1) > 1 && (
                                  <div style={{ fontSize:"0.72rem", color:"#64748b", marginTop:2 }}>
                                    {new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(p?.unit_price||0))} × {Number(p?.quantity||1)} units
                                  </div>
                                )}
                              </td>
                              <td style={{ padding:"12px 14px", color:"#22c55e", fontWeight:700 }}>
                                {new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(p?.total_amount||p?.product_amount||p?.amount||0))}
                              </td>
                              <td style={{ padding:"12px 14px" }}>
                                <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:20, fontSize:"0.72rem", fontWeight:700, color:col, background:`${col}20`, border:`1px solid ${col}40` }}>
                                  {p?.status||"—"}
                                </span>
                              </td>
                              <td style={{ padding:"12px 14px", color:"#64748b", fontSize:"0.82rem" }}>{fmtDate(p?.paid_at||p?.created_at)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop:"2px solid rgba(255,255,255,0.1)" }}>
                          <td colSpan={2} style={{ padding:"12px 14px", fontWeight:700, color:"#e2e8f0" }}>Total Paid</td>
                          <td style={{ padding:"12px 14px", fontWeight:800, color:"#22c55e", fontSize:"1rem" }}>
                            {new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2})
                              .format(myPayouts.filter((p)=>String(p?.status||"").toUpperCase()==="PAID").reduce((s,p)=>s+Number(p?.total_amount||p?.product_amount||p?.amount||0),0))}
                          </td>
                          <td colSpan={2} style={{ padding:"12px 14px", color:"#64748b", fontSize:"0.82rem" }}>
                            {myPayouts.filter((p)=>String(p?.status||"").toUpperCase()==="PAID").length} paid ·{" "}
                            {myPayouts.filter((p)=>String(p?.status||"").toUpperCase()!=="PAID").length} pending
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;