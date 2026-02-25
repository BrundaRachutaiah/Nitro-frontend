import { useState } from "react";
import { approveProof, rejectProof } from "../../api/verification.api";

const ApproveRejectionButton = ({ id, onDone }) => {
  const [submitting, setSubmitting] = useState(false);

  const handleApprove = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await approveProof(id);
      if (onDone) onDone();
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message || "Failed to approve proof.";
      if (status === 404 && onDone) {
        onDone();
      }
      window.alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await rejectProof(id);
      if (onDone) onDone();
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message || "Failed to reject proof.";
      if (status === 404 && onDone) {
        onDone();
      }
      window.alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-actions">
      <button className="admin-btn" onClick={handleApprove} disabled={submitting}>Approve</button>
      <button className="admin-btn" onClick={handleReject} disabled={submitting}>Reject</button>
    </div>
  );
};

export default ApproveRejectionButton;
