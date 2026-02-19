import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMyAllocationTracking } from "../../api/allocation.api";
import { submitReview, uploadReviewProofs } from "../../api/participant.api";
import "./ActionForms.css";
import "./SubmitReview.css";

const SubmitReview = () => {
  const navigate = useNavigate();
  const { id, allocationId: routeAllocationId } = useParams();
  const [allocationId, setAllocationId] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [reviewFiles, setReviewFiles] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [allocations, setAllocations] = useState([]);
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
          const mode = String(row?.projects?.mode || "").toUpperCase();
          const proofStatus = String(row?.purchase_proof?.status || "").toUpperCase();
          const proofSubmitted = proofStatus === "PENDING" || proofStatus === "APPROVED";
          return (mode === "MARKETPLACE" || mode === "D2C") && proofSubmitted && !row?.review_submission;
        });
        setAllocations(candidates);
        if (candidates.length) {
          const fromRoute = routeAllocationId && candidates.some((row) => row.id === routeAllocationId)
            ? routeAllocationId
            : candidates[0].id;
          setAllocationId(fromRoute);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load allocations.");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!allocationId) {
      setError("Please select allocation.");
      return;
    }

    if (selectedMode === "MARKETPLACE" && reviewFiles.length === 0 && !reviewUrl.trim()) {
      setError("Marketplace mode requires review screenshot upload or review URL.");
      return;
    }

    if (selectedMode === "D2C" && !reviewText.trim() && reviewFiles.length === 0 && !reviewUrl.trim()) {
      setError("For D2C, add review text and/or review screenshot.");
      return;
    }

    try {
      setSubmitting(true);
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
      setReviewFiles([]);
      setReviewText("");
      setReviewUrl("");
    } catch (err) {
      setError(err.response?.data?.message || "Review submission failed.");
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
          <button type="button" className="active" onClick={() => navigate(participantAllocationPath)}>Allocations</button>
          <button type="button" onClick={() => navigate(participantPayoutPath)}>Payouts</button>
        </nav>
      </header>

      <main className="participant-review-main">
        <header className="participant-action-header">
          <div>
            <h1>Submit Review</h1>
            <p>Upload product screenshot and submit review text for Marketplace or D2C allocations.</p>
          </div>
          <button type="button" className="participant-action-back" onClick={() => navigate(participantAllocationPath)}>
            Back to Allocations
          </button>
        </header>

        <section className="participant-action-card">
          {error ? <p className="participant-action-error">{error}</p> : null}
          {message ? <p className="participant-action-success">{message}</p> : null}
          {loading ? <p className="participant-action-muted">Loading allocations...</p> : null}
          {!loading && !allocations.length ? (
            <p className="participant-action-muted">No allocations are ready for review submission.</p>
          ) : null}

          {!loading && allocations.length ? (
            <form onSubmit={handleSubmit} className="participant-action-form">
              <label htmlFor="allocationId">Allocation</label>
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
                  Mode: {selectedMode || "-"} {selectedMode === "MARKETPLACE" ? "(Review screenshot is required)" : "(Review text and screenshot are allowed)"}
                </p>
              ) : null}

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

              <button type="submit" disabled={submitting}>
                Submit Review
              </button>
            </form>
          ) : null}
        </section>
      </main>
    </div>
  );
};

export default SubmitReview;
