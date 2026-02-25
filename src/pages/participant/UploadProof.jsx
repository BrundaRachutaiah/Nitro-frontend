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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
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
        const candidates = rows.filter((row) => !row?.purchase_proof);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!allocationId || !file) {
      setError("Please select a task and upload proof.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      await uploadPurchaseProof(allocationId, formData);
      setMessage("Purchase proof uploaded successfully. Waiting for admin verification.");
      setFile(null);
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
                </p>
              ) : null}

              <label htmlFor="proofFile">Invoice/Proof File</label>
              <input id="proofFile" type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files[0])} />

              <button type="submit">Upload Invoice / Proof</button>
            </form>
          ) : null}
        </section>
      </main>
    </div>
  );
};

export default UploadProof;
