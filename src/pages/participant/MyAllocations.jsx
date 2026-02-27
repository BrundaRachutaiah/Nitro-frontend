import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getMyAllocationTracking, updateAllocationStatus } from "../../api/allocation.api";
import "./MyAllocations.css";

const PURCHASE_KEY_PREFIX = "nitro_purchased_";

const fmtCurrency = (v) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v || 0));

const proofDone   = (p) => Boolean(p) && String(p?.status || "").toUpperCase() !== "REJECTED";
const reviewDone  = (r) => Boolean(r) && String(r?.status || "").toUpperCase() !== "REJECTED";
const statusOf    = (x) => String(x?.status || "PENDING").toUpperCase();

const MyAllocations = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { id }    = useParams();
  const query     = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryAllocId  = query.get("allocation");
  const showHistory   = query.get("view") === "history";

  const [data,       setData]       = useState([]);
  const [activeId,   setActiveId]   = useState("");
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [saving,     setSaving]     = useState(false);
  const [purchased,  setPurchased]  = useState({});

  const storageKey = `${PURCHASE_KEY_PREFIX}${id || "x"}`;

  // Load purchased state from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setPurchased(JSON.parse(raw) || {});
    } catch { setPurchased({}); }
  }, [storageKey]);

  // Save purchased state to localStorage
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(purchased)); } catch { /* ignore */ }
  }, [purchased, storageKey]);

  // Load allocations
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
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load tasks.");
      } finally { setLoading(false); }
    })();
  }, [queryAllocId]);

  const ACTIVE = ["RESERVED","PURCHASED"];
  const currentData = useMemo(() => data.filter((r) => ACTIVE.includes(String(r?.status||"").toUpperCase())), [data]);
  const historyData = useMemo(() => data.filter((r) => !ACTIVE.includes(String(r?.status||"").toUpperCase())), [data]);
  const viewData    = showHistory ? historyData : currentData;

  const active = useMemo(() =>
    viewData.find((r) => r.id === activeId) ||
    data.find((r)    => r.id === activeId) ||
    viewData[0] || data[0] || null
  , [activeId, viewData, data]);

  const products      = useMemo(() => Array.isArray(active?.selected_products) ? active.selected_products : [], [active]);
  const status        = String(active?.status || "RESERVED").toUpperCase();
  const isCompleted   = status === "COMPLETED";
  const isPurchased   = status === "PURCHASED";
  const isPurchaseConfirmed = Boolean(purchased[active?.id] || isPurchased || isCompleted ||
    products.some((p) => proofDone(p.purchase_proof)));

  const project       = active?.projects || {};
  const projectName   = project.title || project.name || "Campaign";
  const totalValue    = products.reduce((s, p) => s + Number(p?.product_value || 0), 0);
  const requiresFeedback = String(project.mode || "").toUpperCase() === "MARKETPLACE";
  const allInvDone    = products.length > 0 && products.every((p) => proofDone(p.purchase_proof));
  const allRevDone    = products.length > 0 && products.every((p) => reviewDone(p.review_submission));

  const timeLeft = useMemo(() => {
    if (isCompleted || !active?.reserved_until) return { d:0, h:0, m:0, s:0 };
    let diff = Math.max(0, new Date(active.reserved_until).getTime() - Date.now());
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5);  diff -= h * 36e5;
    const m = Math.floor(diff / 6e4);   diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    return { d, h, m, s };
  }, [active, isCompleted]);

  // Navigation paths
  const P = {
    dash:    id ? `/participant/${id}/dashboard`                          : "/dashboard",
    tasks:   id ? `/participant/${id}/allocation/active`                  : "/dashboard",
    history: id ? `/participant/${id}/allocation/active?view=history`     : "/dashboard",
    payouts: id ? `/participant/${id}/payouts`                            : "/dashboard",
    task:    (aId, pId) => `/participant/${id}/product-task/${aId}${pId ? `?product=${encodeURIComponent(pId)}` : ""}`,
  };

  const confirmPurchase = async () => {
    if (!active?.id || saving) return;
    setPurchased((prev) => ({ ...prev, [active.id]: true }));
    setSaving(true);
    try {
      await updateAllocationStatus(active.id, "PURCHASED");
      setData((prev) => prev.map((r) => r.id === active.id ? { ...r, status: "PURCHASED" } : r));
    } catch (err) {
      setError(err.response?.data?.message || "Could not update status — marked purchased locally.");
    } finally { setSaving(false); }
  };

  // Submission history for current allocation
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

  // Status chip color
  const chipColor = (s) => ({
    APPROVED: "#22c55e", PENDING: "#f59e0b", REJECTED: "#ef4444",
    SUBMITTED: "#3b82f6", COMPLETED: "#10b981", PURCHASED: "#06b6d4",
    RESERVED: "#06b6d4", EXPIRED: "#f97316"
  }[s] || "#94a3b8");

  return (
    <div className="ma-page">
      {/* ── TOPBAR ── */}
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
        {/* Page header */}
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
            {/* ── LEFT SIDEBAR ── */}
            <aside className="ma-sidebar">
              {/* Campaign switcher */}
              <div className="ma-panel">
                <div className="ma-panel-label">📋 Campaign</div>
                {viewData.length > 1 ? (
                  <div className="ma-switcher">
                    {viewData.map((r) => {
                      const name = r?.projects?.title || r?.projects?.name || "Untitled";
                      const s    = String(r?.status||"").toUpperCase();
                      return (
                        <button key={r.id} type="button" className={`ma-switch-btn ${r.id === active?.id ? "active" : ""}`} onClick={() => setActiveId(r.id)}>
                          <span className="ma-switch-name">{name}</span>
                          <span className="ma-switch-chip" style={{ color: chipColor(s) }}>{s}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <div className="ma-campaign-name">{projectName}</div>
                    <span className="ma-status-chip" style={{ background: `${chipColor(status)}22`, color: chipColor(status), border: `1px solid ${chipColor(status)}55` }}>{status}</span>
                  </>
                )}
              </div>

              {/* Timer */}
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

              {/* Estimated payout */}
              {!showHistory && (
                <div className="ma-panel">
                  <div className="ma-panel-label">💰 Estimated Payout</div>
                  <div className="ma-payout-amt">{fmtCurrency(totalValue)}</div>
                  <div className="ma-payout-note">Reimbursement after approval</div>
                </div>
              )}

              {/* Steps overview */}
              {!showHistory && (
                <div className="ma-panel">
                  <div className="ma-panel-label">📌 Steps Overview</div>
                  <div className="ma-steps-list">
                    {[
                      ["Reservation Confirmed",  true],
                      ["Purchase Products",       isPurchaseConfirmed],
                      ["Upload Invoices",         allInvDone],
                      ["Submit Reviews",          allRevDone],
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

            {/* ── MAIN CONTENT ── */}
            <div className="ma-content">

              {/* STEP 1: Purchase Confirmation */}
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
                          <div className="ma-product-row-price">{fmtCurrency(p.product_value)}</div>
                        </div>
                      ))}
                      <div className="ma-product-total">
                        <span>Total to spend</span>
                        <strong>{fmtCurrency(totalValue)}</strong>
                      </div>
                    </div>
                  )}

                  <button type="button" className="ma-btn-primary" onClick={confirmPurchase} disabled={saving}>
                    {saving ? "Saving…" : "✓ I've Purchased All Products"}
                  </button>
                </div>
              )}

              {/* STEP 2+3: Per-product invoice & review */}
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

                      return (
                        <div key={pId || i} className={`ma-prod-card ${iDone && rDone ? "ma-prod-done" : ""}`}>
                          <div className="ma-prod-num">{i + 1}</div>
                          <div className="ma-prod-body">
                            <div className="ma-prod-name">{prod.product_name || "Product"}</div>
                            <div className="ma-prod-price">{fmtCurrency(prod.product_value)}</div>

                            <div className="ma-prod-steps">
                              {/* Invoice step */}
                              <div className={`ma-prod-step ${iDone ? "done" : "todo"}`}>
                                <div className="ma-prod-step-icon">{iDone ? "✅" : "📄"}</div>
                                <div className="ma-prod-step-info">
                                  <div className="ma-prod-step-label">Invoice Upload</div>
                                  <div className="ma-prod-step-status">
                                    {iDone
                                      ? (statusOf(inv) === "APPROVED" ? "Approved ✓" : "⏳ Under Review")
                                      : "Not Uploaded"}
                                  </div>
                                </div>
                                {!iDone && (
                                  <button type="button" className="ma-prod-btn" onClick={() => navigate(P.task(active.id, pId))}>
                                    Upload Invoice →
                                  </button>
                                )}
                              </div>

                              {/* Review step */}
                              <div className={`ma-prod-step ${rDone ? "done" : iDone ? "todo" : "locked"}`}>
                                <div className="ma-prod-step-icon">{rDone ? "✅" : iDone ? "⭐" : "🔒"}</div>
                                <div className="ma-prod-step-info">
                                  <div className="ma-prod-step-label">Review Submission</div>
                                  <div className="ma-prod-step-status">
                                    {rDone
                                      ? (statusOf(rev) === "APPROVED" ? "Approved ✓" : "⏳ Under Review")
                                      : iDone ? "Ready to submit" : "Upload Invoice First"}
                                  </div>
                                </div>
                                {iDone && !rDone && (
                                  <button type="button" className="ma-prod-btn" onClick={() => navigate(P.task(active.id, pId))}>
                                    Submit Review →
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }) : (
                      /* No products — single allocation fallback */
                      <div className="ma-prod-card">
                        <div className="ma-prod-body" style={{ paddingLeft: 0 }}>
                          <div className="ma-prod-name">{projectName}</div>
                          <button type="button" className="ma-btn-primary" onClick={() => navigate(P.task(active.id, ""))}>
                            Upload Invoice &amp; Review →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {allInvDone && allRevDone && (
                    <div className="ma-all-done-banner">
                      🎉 All invoices and reviews submitted! Check your <button type="button" className="ma-link-btn" onClick={() => navigate(P.payouts)}>Payout status →</button>
                    </div>
                  )}
                </div>
              )}

              {/* Submission History */}
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
    </div>
  );
};

export default MyAllocations;