import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMyAllocationTracking } from "../../api/allocation.api";
import { submitFeedback } from "../../api/participant.api";
import "./ActionForms.css";

const SubmitFeedback = () => {
  const navigate = useNavigate();
  const { id, allocationId: routeAllocationId } = useParams();
  const [allocationId, setAllocationId] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getMyAllocationTracking();
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        const candidates = rows.filter((row) => {
          const mode = String(row?.projects?.mode || "").toUpperCase();
          const proofApproved = String(row?.purchase_proof?.status || "").toUpperCase() === "APPROVED";
          const reviewSubmitted = !!row?.review_submission;
          return mode === "MARKETPLACE" && proofApproved && reviewSubmitted && !row?.feedback_submission;
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

    if (selectedMode !== "MARKETPLACE") {
      setError("Internal feedback submission is only for Marketplace mode projects.");
      return;
    }

    if (!text.trim()) {
      setError("Please add feedback text.");
      return;
    }

    try {
      await submitFeedback({
        allocationId,
        rating: Number(rating),
        feedbackText: text.trim()
      });
      setMessage("Feedback submitted successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Feedback submission failed.");
    }
  };

  return (
    <div className="participant-action-page">
      <header className="participant-action-header">
        <div>
          <h1>Submit Marketplace Feedback</h1>
          <p>Feedback is required for Marketplace mode after review proof submission.</p>
        </div>
        <button type="button" className="participant-action-back" onClick={() => navigate(`/participant/${id}/allocation/active`)}>
          Back to Allocations
        </button>
      </header>

      <section className="participant-action-card">
        {error ? <p className="participant-action-error">{error}</p> : null}
        {message ? <p className="participant-action-success">{message}</p> : null}
        {loading ? <p className="participant-action-muted">Loading allocations...</p> : null}
        {!loading && !allocations.length ? (
          <p className="participant-action-muted">No Marketplace allocations are ready for feedback.</p>
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

            {selectedAllocation ? <p className="participant-action-note">Mode: {selectedMode || "-"}</p> : null}
            <p className="participant-action-note">Marketplace feedback is required for payout completion.</p>

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
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
            />

            <button type="submit">Submit Mandatory Feedback</button>
          </form>
        ) : null}
      </section>
    </div>
  );
};

export default SubmitFeedback;
