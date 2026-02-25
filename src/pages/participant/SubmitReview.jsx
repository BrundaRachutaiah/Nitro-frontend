import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMyAllocationTracking } from "../../api/allocation.api";
import { submitFeedback, submitReview, uploadReviewProofs } from "../../api/participant.api";
import "./ActionForms.css";
import "./SubmitReview.css";

const SubmitReview = () => {
  const navigate = useNavigate();
  const { id, allocationId: routeAllocationId } = useParams();
  const [allocationId, setAllocationId] = useState("");
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
  const participantDashboardPath = id ? `/participant/${id}/dashboard` : "/dashboard";
  const participantTasksPath = id ? `/participant/${id}/allocation/active` : "/dashboard";
  const participantPayoutPath = id ? `/participant/${id}/payouts` : "/dashboard";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getMyAllocationTracking();
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        const candidates = rows.filter((row) => {
          const mode = String(row?.projects?.mode || "").toUpperCase();
          const proofStatus = String(row?.purchase_proof?.status || "").toUpperCase();
          const proofSubmitted = proofStatus === "PENDING" || proofStatus === "APPROVED";
          const proofApproved = proofStatus === "APPROVED";
          const needsReview = (mode === "MARKETPLACE" || mode === "D2C") && proofSubmitted && !row?.review_submission;
          const needsFeedback = mode === "MARKETPLACE" && proofApproved && Boolean(row?.review_submission) && !row?.feedback_submission;
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

  const selectedMode = String(selectedAllocation?.projects?.mode || "").toUpperCase();
  const needsReview = Boolean(selectedAllocation) && !selectedAllocation?.review_submission;
  const needsFeedback = selectedMode === "MARKETPLACE" && Boolean(selectedAllocation?.review_submission) && !selectedAllocation?.feedback_submission;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!allocationId) {
      setError("Please select a task.");
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
          const uploadRes = await uploadReviewProofs(allocationId, formData);
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
          reviewText: finalReviewText,
          reviewUrl: finalReviewUrl
        });
        setMessage("Review submitted and awaiting admin approval.");
      } else if (needsFeedback) {
        if (!feedbackText.trim()) {
          setError("Please add your feedback.");
          setSubmitting(false);
          return;
        }

        await submitFeedback({
          allocationId,
          rating: Number(rating),
          feedbackText: feedbackText.trim()
        });
        setMessage("Feedback submitted successfully.");
      }

      setReviewFiles([]);
      setReviewText("");
      setReviewUrl("");
      setFeedbackText("");
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
          {message ? <p className="participant-action-success">{message}</p> : null}
          {loading ? <p className="participant-action-muted">Loading allocations...</p> : null}
          {!loading && !allocations.length ? (
            <p className="participant-action-muted">No review or feedback tasks are pending.</p>
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
                  Task: {needsReview ? "Submit Review" : needsFeedback ? "Submit Feedback" : "Completed"}
                </p>
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
                {submitting ? "Submitting..." : needsReview ? "Submit Review" : needsFeedback ? "Submit Feedback" : "Completed"}
              </button>
            </form>
          ) : null}
        </section>
      </main>
    </div>
  );
};

export default SubmitReview;
