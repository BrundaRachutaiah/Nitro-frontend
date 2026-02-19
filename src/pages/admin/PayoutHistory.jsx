import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { exportBatchesCSV, getBatches } from "../../api/payout.api";
import "../superAdmin/AdminPages.css";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));

const formatAddress = (participant) => {
  if (!participant) return "-";
  const parts = [
    participant.address_line1,
    participant.address_line2,
    participant.city,
    participant.state,
    participant.pincode,
    participant.country
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "-";
};

const formatParticipantLabel = (batch) => {
  const rows = Array.isArray(batch?.participants) ? batch.participants : [];
  if (!rows.length) return "-";
  const first = rows[0];
  const firstLabel = first?.full_name || first?.email || "-";
  if (rows.length === 1) return firstLabel;
  return `${firstLabel} +${rows.length - 1} more`;
};

const PayoutHistory = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadHistory = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await getBatches({ status: "PAID", limit: 500 });
      setRows(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      setRows([]);
      setError(err.response?.data?.message || "Failed to load payout history.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportAll = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await exportBatchesCSV({ status: "PAID" });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "payout_history_paid.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccess("Payout history exported successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to export payout history.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const totalPaid = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row?.total_amount || 0), 0),
    [rows]
  );

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Payout History</h1>
          <p>All completed payout batches are listed here.</p>
        </div>
        <div className="admin-head-actions">
          <button className="admin-btn" onClick={() => navigate("/admin/payouts")}>Back to Payouts</button>
          <button className="admin-btn" onClick={loadHistory} disabled={saving}>Refresh</button>
          <button className="admin-btn primary" onClick={handleExportAll} disabled={saving || loading || !rows.length}>
            Export Paid CSV
          </button>
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}
      {success ? <p className="admin-success">{success}</p> : null}

      <section className="admin-panel mb-3">
        <h3 className="mb-1">Completed Batches: {rows.length}</h3>
        <p style={{ margin: 0, color: "#50667d" }}>Total Paid Amount: {formatCurrency(totalPaid)}</p>
      </section>

      <section className="admin-panel admin-table-wrap">
        {loading ? <p>Loading payout history...</p> : null}
        {!loading && !rows.length ? <p className="admin-empty">No paid payout batches found.</p> : null}
        {!loading && rows.length ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Participant</th>
                <th>Account Number</th>
                <th>IFSC</th>
                <th>Address</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((batch) => {
                const primaryParticipant = Array.isArray(batch?.participants) ? batch.participants[0] : null;
                return (
                  <tr key={batch.id}>
                    <td>{batch.id}</td>
                    <td title={formatParticipantLabel(batch)}>{formatParticipantLabel(batch)}</td>
                    <td>{primaryParticipant?.bank_account_number || "-"}</td>
                    <td>{primaryParticipant?.bank_ifsc || "-"}</td>
                    <td title={formatAddress(primaryParticipant)}>{formatAddress(primaryParticipant)}</td>
                    <td>{formatCurrency(batch.total_amount)}</td>
                    <td><span className="admin-badge paid">PAID</span></td>
                    <td>{batch?.created_at ? new Date(batch.created_at).toLocaleString() : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
};

export default PayoutHistory;
