import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createBatch } from "../../api/payout.api";
import "../superAdmin/AdminPages.css";

const CreateBatch = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await createBatch({});
      setSuccess(res?.data?.message || "Batch created.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create payout batch.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Create Payout Batch</h1>
          <p>Create a batch from all currently eligible payouts</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="admin-btn" onClick={() => navigate("/admin/payouts")}>Back</button>
        </div>
      </div>

      <section className="admin-panel">
        <form onSubmit={handleSubmit}>
          <button type="submit" className="admin-btn primary" disabled={saving}>
            {saving ? "Creating..." : "Create Batch"}
          </button>
        </form>
        {error ? <p className="admin-error">{error}</p> : null}
        {success ? <p className="admin-success">{success}</p> : null}
      </section>
    </div>
  );
};

export default CreateBatch;
