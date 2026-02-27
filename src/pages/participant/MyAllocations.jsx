import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getMyAllocationTracking, updateAllocationStatus } from "../../api/allocation.api";
import "./MyAllocations.css";

const PURCHASE_MARKER_KEY_PREFIX = "nitro_purchase_confirmed_by_allocation";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));

const MyAllocations = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryAllocationId = query.get("allocation");
  const showHistoryOnly = query.get("view") === "history";
  const [data, setData] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [purchaseConfirmedByAllocation, setPurchaseConfirmedByAllocation] = useState({});
  const storageKey = `${PURCHASE_MARKER_KEY_PREFIX}_${id || "unknown"}`;

  const normalizeDecisionMap = (value) => {
    if (!value || typeof value !== "object") return {};
    const next = {};
    Object.entries(value).forEach(([allocationId, decision]) => {
      if (decision === true || decision === "true") next[allocationId] = true;
      if (decision === false || decision === "false") next[allocationId] = false;
    });
    return next;
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const normalized = normalizeDecisionMap(parsed);
      if (Object.keys(normalized).length > 0) {
        setPurchaseConfirmedByAllocation(normalized);
      }
    } catch {
      setPurchaseConfirmedByAllocation({});
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(purchaseConfirmedByAllocation));
    } catch {
      // Ignore storage write errors; in-memory state still updates UI.
    }
  }, [purchaseConfirmedByAllocation, storageKey]);

  useEffect(() => {
    const loadAllocations = async () => {
      try {
        const res = await getMyAllocationTracking();
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        setData(rows);
        if (rows.length > 0) {
          const matching = queryAllocationId
            ? rows.find((item) => item.id === queryAllocationId)
            : null;
          setActiveId(matching?.id || rows[0].id);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load tasks.");
      } finally {
        setLoading(false);
      }
    };

    loadAllocations();
  }, [queryAllocationId]);

  const active = useMemo(() => {
    return data.find((item) => item.id === activeId) || data[0] || null;
  }, [activeId, data]);
  const singleAllocationMode = Boolean(queryAllocationId) && !showHistoryOnly;

  const project = active?.projects || {};
  const selectedProducts = Array.isArray(active?.selected_products) ? active.selected_products : [];
  const productValueFromSet = selectedProducts.reduce((sum, item) => sum + Number(item?.product_value || 0), 0);
  const selectedProductValue = Number(active?.selected_product?.product_value || 0);
  const productValue = productValueFromSet > 0
    ? productValueFromSet
    : selectedProductValue > 0
      ? selectedProductValue
      : Number(project?.product_value || 0);
  const totalPayout = productValue;
  const projectName = project?.title || project?.name || "Campaign Product";
  const requiresFeedback = String(project?.mode || "").toUpperCase() === "MARKETPLACE";
  const status = String(active?.status || "RESERVED").toUpperCase();
  const isCompleted = status === "COMPLETED";
  const isPurchased = status === "PURCHASED";
  const activeReviewStatus = String(active?.review_submission?.status || "").toUpperCase();
  const hasValidReviewSubmission = Boolean(active?.review_submission) && activeReviewStatus !== "REJECTED";
  const hasPurchaseProof = Boolean(active?.purchase_proof)
    || selectedProducts.some((item) => Boolean(item?.purchase_proof) && String(item?.purchase_proof?.status || "").toUpperCase() !== "REJECTED");
  const hasFeedbackSubmission = Boolean(active?.feedback_submission);
  const requiredFlowCompleted = requiresFeedback
    ? hasPurchaseProof && hasValidReviewSubmission && hasFeedbackSubmission
    : hasPurchaseProof;
  const isReviewStepDone = hasValidReviewSubmission || hasFeedbackSubmission;
  const isReviewStepActive = !isReviewStepDone && (hasPurchaseProof || isCompleted);
  const purchaseDecision = active?.id ? purchaseConfirmedByAllocation[active.id] : undefined;
  const isPurchaseConfirmed = Boolean(
    purchaseDecision === true || isPurchased || hasPurchaseProof || isCompleted
  );
  const stopCountdown = isCompleted || requiredFlowCompleted;
  const daysLeft = useMemo(() => {
    if (stopCountdown || !active?.reserved_until) return 0;
    const diff = new Date(active.reserved_until).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [active, stopCountdown]);

  const timeLeft = useMemo(() => {
    if (stopCountdown || !active?.reserved_until) return { days: 0, hours: 0, mins: 0, secs: 0 };
    let diff = Math.max(0, new Date(active.reserved_until).getTime() - Date.now());
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    diff -= days * 24 * 60 * 60 * 1000;
    const hours = Math.floor(diff / (60 * 60 * 1000));
    diff -= hours * 60 * 60 * 1000;
    const mins = Math.floor(diff / (60 * 1000));
    diff -= mins * 60 * 1000;
    const secs = Math.floor(diff / 1000);
    return { days, hours, mins, secs };
  }, [active, stopCountdown]);
  const participantDashboardPath = id ? `/participant/${id}/dashboard` : "/dashboard";
  const participantPayoutPath = id ? `/participant/${id}/payouts` : "/dashboard";
  const participantTasksPath = id ? `/participant/${id}/allocation/active` : "/dashboard";
  const participantHistoryPath = id ? `/participant/${id}/allocation/active?view=history` : "/dashboard";

  const getDisplayStatus = (item) => {
    const rawStatus = String(item?.status || "RESERVED").toUpperCase();
    if (rawStatus === "RESERVED" && purchaseConfirmedByAllocation[item?.id] === true) {
      return "PURCHASED";
    }
    return rawStatus;
  };

  const markPurchaseDecision = async (value) => {
    if (!active?.id) return;
    setError("");

    // Persist user's choice first so UI reflects the action immediately.
    setPurchaseConfirmedByAllocation((prev) => ({
      ...prev,
      [active.id]: value
    }));

    if (value === true && !isPurchased && !isCompleted) {
      try {
        setPurchaseSaving(true);
        await updateAllocationStatus(active.id, "PURCHASED");
        setData((prev) =>
          prev.map((row) => (row.id === active.id ? { ...row, status: "PURCHASED" } : row))
        );
      } catch (err) {
        setError(
          `${err.response?.data?.message || "Unable to update allocation status."} Showing PURCHASED in UI from your selection.`
        );
        setPurchaseSaving(false);
      } finally {
        setPurchaseSaving(false);
      }
    }
  };

  const getProofLabel = (item) => {
    const proof = item?.purchase_proof;
    if (!proof) return "Invoice not uploaded";
    const statusLabel = String(proof?.status || "PENDING").toUpperCase();
    if (statusLabel === "PENDING") return "Successfully uploaded, waiting for review";
    if (statusLabel === "APPROVED") return "Proof approved";
    if (statusLabel === "REJECTED") return "Proof rejected, please re-upload";
    return statusLabel;
  };

  const getReviewLabel = (item) => {
    const review = item?.review_submission;
    const feedback = item?.feedback_submission;
    if (review) {
      const reviewStatus = String(review?.status || "PENDING").toUpperCase();
      if (reviewStatus === "PENDING") return "Review uploaded successfully, admin approval required";
      if (reviewStatus === "APPROVED") return "Review approved";
      if (reviewStatus === "REJECTED") return "Review rejected, please update and resubmit";
      return `Review ${reviewStatus}`;
    }
    if (feedback) return `Feedback submitted (${Number(feedback?.rating || 0)}/5)`;
    return "Review not submitted";
  };

  const getPayoutLabel = (item) => {
    const payout = item?.payout;
    if (!payout) return "Not eligible yet";
    return `${String(payout?.status || "ELIGIBLE").toUpperCase()} - ${formatCurrency(payout?.amount)}`;
  };

  const submissionHistory = useMemo(() => {
    const history = [];

    data.forEach((item) => {
      const projectName = item?.projects?.title || item?.projects?.name || "Untitled";
      const allocationId = item?.id || "";

      if (item?.purchase_proof?.created_at) {
        history.push({
          key: `proof-${item.purchase_proof.id || allocationId}`,
          allocationId,
          at: item.purchase_proof.created_at,
          projectName,
          activity: "Invoice Uploaded",
          details: item?.purchase_proof?.file_url ? "Purchase proof submitted" : "Purchase proof submitted",
          status: String(item?.purchase_proof?.status || "PENDING").toUpperCase()
        });
      }

      if (item?.review_submission?.created_at) {
        history.push({
          key: `review-${item.review_submission.id || allocationId}`,
          allocationId,
          at: item.review_submission.created_at,
          projectName,
          activity: "Review Submitted",
          details: item?.review_submission?.review_url ? "Review text/screenshot submitted" : "Review submitted",
          status: String(item?.review_submission?.status || "PENDING").toUpperCase()
        });
      }

      if (item?.feedback_submission?.created_at) {
        history.push({
          key: `feedback-${item.feedback_submission.id || allocationId}`,
          allocationId,
          at: item.feedback_submission.created_at,
          projectName,
          activity: "Feedback Submitted",
          details: `Rating ${Number(item?.feedback_submission?.rating || 0)}/5`,
          status: "SUBMITTED"
        });
      }
    });

    return history
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  }, [data]);
  const scopedTrackingData = useMemo(() => {
    if (singleAllocationMode && active?.id) return data.filter((item) => item.id === active.id);
    return data;
  }, [singleAllocationMode, active?.id, data]);

  const scopedSubmissionHistory = useMemo(() => {
    if (singleAllocationMode && active?.id) {
      return submissionHistory.filter((row) => row.allocationId === active.id);
    }
    return submissionHistory;
  }, [singleAllocationMode, active?.id, submissionHistory]);

  return (
    <div className="allocation-page">
      <header className="allocation-topbar">
        <div className="allocation-brand">Nitro</div>
        <nav>
          <button type="button" onClick={() => navigate(participantDashboardPath)}>Dashboard</button>
          <button type="button" className={showHistoryOnly ? "" : "active"} onClick={() => navigate(participantTasksPath)}>My Tasks</button>
          <button type="button" className={showHistoryOnly ? "active" : ""} onClick={() => navigate(participantHistoryPath)}>History</button>
          <button type="button" onClick={() => navigate(participantPayoutPath)}>Payouts</button>
        </nav>
      </header>

      <main className="allocation-main-shell">
        <section className="allocation-main-head">
          <h1>My Tasks</h1>
          <p>Complete each step in order to finish your program.</p>
        </section>

        {loading ? <p className="allocation-loading">Loading tasks...</p> : null}
        {error ? <p className="allocation-error">{error}</p> : null}

        {!loading && !data.length ? (
          <div className="allocation-empty">
            <p>No active tasks available.</p>
            <button type="button" onClick={() => navigate(participantDashboardPath)}>Back to Dashboard</button>
          </div>
        ) : (
          <>
            {!singleAllocationMode ? (
              <section className="allocation-switcher">
                {data.map((item) => {
                  const name = item?.projects?.title || item?.projects?.name || "Untitled";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={active?.id === item.id ? "active" : ""}
                      onClick={() => setActiveId(item.id)}
                    >
                      <strong>{name}</strong>
                      <span>{getDisplayStatus(item)}</span>
                    </button>
                  );
                })}
              </section>
            ) : null}

            {!showHistoryOnly ? (
              <section className="allocation-countdown">
                <div><strong>{String(timeLeft.days).padStart(2, "0")}</strong><span>DAYS</span></div>
                <div><strong>{String(timeLeft.hours).padStart(2, "0")}</strong><span>HOURS</span></div>
                <div><strong>{String(timeLeft.mins).padStart(2, "0")}</strong><span>MINS</span></div>
                <div><strong>{String(timeLeft.secs).padStart(2, "0")}</strong><span>SECS</span></div>
              </section>
            ) : null}

            {!showHistoryOnly ? (
            <section className="allocation-upload-card">
              <h2>Current Task</h2>
              {selectedProducts.length ? (
                <div className="allocation-product-set">
                  <p className="allocation-product-set-title">Approved Product Set ({selectedProducts.length})</p>
                  <ul>
                    {selectedProducts.map((item) => (
                      <li key={item.application_id || item.product_id || `${item.product_name}-${item.product_value}`}>
                        <span>{item.product_name || "Product"}</span>
                        <strong>{formatCurrency(item.product_value || 0)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!isPurchaseConfirmed ? (
                <>
                  <p>Confirm that you purchased this approved product set in <strong>{projectName}</strong> to unlock the next steps.</p>
                  <div className="allocation-actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={() => markPurchaseDecision(true)}
                      disabled={hasPurchaseProof || isCompleted || purchaseSaving}
                    >
                      {purchaseSaving ? "Saving..." : "I Purchased This Product"}
                    </button>
                  </div>
                </>
              ) : !hasPurchaseProof ? (
                <>
                  <p>Upload invoice proof for this allocation set in <strong>{projectName}</strong>.</p>
                  <div className="allocation-actions">
                    <button type="button" className="primary" onClick={() => navigate(`/participant/${id}/upload-proof/${active?.id || ""}`)}>
                      Upload Invoice
                    </button>
                  </div>
                </>
              ) : !hasValidReviewSubmission ? (
                <>
                  <p>Submit review for this allocation set.</p>
                  <div className="allocation-actions">
                    <button type="button" className="primary" onClick={() => navigate(`/participant/${id}/submit-review/${active?.id || ""}`)}>
                      Submit Review
                    </button>
                  </div>
                </>
              ) : requiresFeedback && !hasFeedbackSubmission ? (
                <>
                  <p>Submit your final feedback to complete this task.</p>
                  <div className="allocation-actions">
                    <button type="button" className="primary" onClick={() => navigate(`/participant/${id}/submit-review/${active?.id || ""}`)}>
                      Submit Feedback
                    </button>
                  </div>
                </>
              ) : (
                <p>All required tasks are complete. You can check payout status on the Payouts page.</p>
              )}
            </section>
            ) : null}

            {!showHistoryOnly ? (
            <section className="allocation-journey">
              <div className="journey-step done">
                <h3><span className="journey-icon">✅</span> Reservation Confirmed</h3>
                <p>Completed</p>
              </div>
              <div className={`journey-step ${isPurchaseConfirmed ? "done" : "active"}`}>
                <h3>Purchase Product</h3>
                <p>{isPurchaseConfirmed ? "Completed" : "Pending action"}</p>
              </div>
              <div className={`journey-step ${hasPurchaseProof || isCompleted ? "done" : isPurchaseConfirmed ? "active" : ""}`}>
                <h3>Upload Invoice</h3>
                <p>
                  {hasPurchaseProof || isCompleted
                    ? "Completed"
                    : isPurchaseConfirmed
                      ? `Due in ${daysLeft} days`
                      : "Complete purchase confirmation first"}
                </p>
              </div>
              <div className={`journey-step ${isReviewStepDone ? "done" : isReviewStepActive ? "active" : "locked"}`}>
                <h3>Submit Review</h3>
                <p>
                  {isReviewStepDone
                    ? "Completed"
                    : "Submit review after purchase proof approval"}
                </p>
              </div>
            </section>
            ) : null}

            <section className="allocation-track-list">
              <h2>Task Tracking</h2>
              <div className="allocation-track-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Status</th>
                      <th>Purchase Proof</th>
                      <th>Review / Feedback</th>
                      <th>Payout</th>
                      <th>Reserved Until</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedTrackingData.map((item) => {
                      const itemProject = item?.projects || {};
                      const name = itemProject?.title || itemProject?.name || "Untitled";
                      const mode = String(itemProject?.mode || "").toUpperCase();
                      const itemStatus = getDisplayStatus(item);
                      const reservedUntil = item?.reserved_until
                        ? new Date(item.reserved_until).toLocaleString()
                        : "-";

                      return (
                        <tr key={`track-${item.id}`}>
                          <td>{name}</td>
                          <td>
                            <span className={`status-chip status-${itemStatus.toLowerCase()}`}>
                              {itemStatus}
                            </span>
                          </td>
                          <td>
                            <div className="allocation-inline-cell">
                              <span>{getProofLabel(item)}</span>
                              {item?.purchase_proof?.file_url ? (
                                <a
                                  href={item.purchase_proof.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View Proof
                                </a>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <div className="allocation-inline-cell">
                              <span>{getReviewLabel(item)}</span>
                              {item?.review_submission?.review_url ? (
                                <a
                                  href={item.review_submission.review_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View Review
                                </a>
                              ) : null}
                              {(!item?.review_submission || String(item?.review_submission?.status || "").toUpperCase() === "REJECTED") ? (
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => navigate(`/participant/${id}/submit-review/${item.id}`)}
                                >
                                  Submit Review
                                </button>
                              ) : null}
                              {mode === "MARKETPLACE"
                              && Boolean(item?.review_submission)
                              && String(item?.review_submission?.status || "").toUpperCase() !== "REJECTED"
                              && !item?.feedback_submission ? (
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => navigate(`/participant/${id}/submit-review/${item.id}`)}
                                >
                                  Submit Feedback
                                </button>
                              ) : null}
                            </div>
                          </td>
                          <td>{getPayoutLabel(item)}</td>
                          <td>{reservedUntil}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="allocation-track-list allocation-history-list">
              <h2>Submission History</h2>
              <p className="allocation-history-note">
                {singleAllocationMode
                  ? "Track invoice uploads and review submissions for this allocation."
                  : "Track invoice uploads and review submissions for all your allocations."}
              </p>
              <div className="allocation-track-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Project</th>
                      <th>Activity</th>
                      <th>Details</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedSubmissionHistory.length ? (
                      scopedSubmissionHistory.map((row) => (
                        <tr key={row.key}>
                          <td>{row.at ? new Date(row.at).toLocaleString() : "-"}</td>
                          <td>{row.projectName}</td>
                          <td>{row.activity}</td>
                          <td>{row.details}</td>
                          <td>{row.status}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5}>No submission history yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="allocation-detail-cards">
              <article>
                <h3>Guidelines</h3>
                <ul>
                  <li>Minimum 150 words review</li>
                  <li>Include product photos if required</li>
                  <li>Submit before reservation expires</li>
                </ul>
              </article>
              <article>
                <h3>Payout</h3>
                <p className="amount">{formatCurrency(totalPayout)}</p>
                <small>Estimated product reimbursement amount</small>
              </article>
              <article>
                <h3>Need Help?</h3>
                <p>Contact support if you face issues with purchase or proof upload.</p>
                <button type="button" onClick={() => navigate(participantTasksPath)}>Refresh Tasks</button>
              </article>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default MyAllocations;
