import { approveProof, rejectProof } from "../../api/verification.api";

const ApproveRejectionButton = ({ id, onDone }) => {
  const handleApprove = async () => {
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
    }
  };

  const handleReject = async () => {
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
    }
  };

  return (
    <div className="admin-actions">
      <button className="admin-btn" onClick={handleApprove}>Approve</button>
      <button className="admin-btn" onClick={handleReject}>Reject</button>
    </div>
  );
};

export default ApproveRejectionButton;
