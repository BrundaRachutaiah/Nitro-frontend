import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createBatch,
  exportBatchCSV,
  getBatches,
  getEligiblePayouts,
  markBatchPaid
} from "../../api/payout.api";
import "../superAdmin/AdminPages.css";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));

const withClientTimeout = (promise, label, timeoutMs = 15000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} request timed out`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });

const Payouts = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [eligibleRows, setEligibleRows] = useState([]);
  const [batchStatusFilter, setBatchStatusFilter] = useState("ALL");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    const [batchRes, eligibleRes] = await Promise.allSettled([
      withClientTimeout(getBatches(), "Payout batches"),
      withClientTimeout(getEligiblePayouts(), "Eligible payouts")
    ]);

    const nextErrors = [];

    if (batchRes.status === "fulfilled") {
      setBatches(Array.isArray(batchRes.value?.data?.data) ? batchRes.value.data.data : []);
    } else {
      const message = batchRes.reason?.response?.data?.message || batchRes.reason?.message || "Failed to load payout batches.";
      nextErrors.push(message);
      setBatches([]);
    }

    if (eligibleRes.status === "fulfilled") {
      setEligibleRows(Array.isArray(eligibleRes.value?.data?.data) ? eligibleRes.value.data.data : []);
    } else {
      const message = eligibleRes.reason?.response?.data?.message || eligibleRes.reason?.message || "Failed to load eligible payouts.";
      nextErrors.push(message);
      setEligibleRows([]);
    }

    if (nextErrors.length) {
      setError(nextErrors.join(" "));
    }

    setLoading(false);
  };

  const handleCreateBatch = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await createBatch({});
      setSuccess(res?.data?.message || "Payout batch created successfully.");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create payout batch.");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (batchId) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await markBatchPaid(batchId);
      setSuccess(res?.data?.message || "Batch marked as paid.");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to mark batch as paid.");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (batchId) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await exportBatchCSV(batchId);
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `payout_batch_${batchId}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to export payout batch.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredBatches = useMemo(() => {
    if (batchStatusFilter === "ALL") return batches;
    return batches.filter((row) => String(row?.status || "").toUpperCase() === batchStatusFilter);
  }, [batches, batchStatusFilter]);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Payout Batches</h1>
          <p>Review eligible payouts, create payout batches, export and mark paid</p>
        </div>
        <div className="admin-head-actions">
          <button className="admin-btn" onClick={() => navigate("/dashboard")}>Back</button>
          <button className="admin-btn" onClick={loadData} disabled={saving}>Refresh</button>
          <button className="admin-btn primary" onClick={handleCreateBatch} disabled={saving || loading || !eligibleRows.length}>
            + Create Batch
          </button>
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}
      {success ? <p className="admin-success">{success}</p> : null}

      <section className="admin-panel admin-table-wrap mb-3">
        <h3 className="mb-2">Eligible Payouts ({eligibleRows.length})</h3>
        {loading ? <p>Loading eligible payouts...</p> : null}
        {!loading && !eligibleRows.length ? <p className="admin-empty">No eligible payouts right now.</p> : null}
        {!loading && eligibleRows.length ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Project</th>
                <th>Reward</th>
                <th>Product</th>
                <th>Total</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {eligibleRows.map((row) => (
                <tr key={row.id}>
                  <td>{row?.profiles?.full_name || row?.profiles?.email || "-"}</td>
                  <td>{row?.projects?.title || row?.projects?.name || "-"}</td>
                  <td>{formatCurrency(row?.reward_amount)}</td>
                  <td>{formatCurrency(row?.product_amount)}</td>
                  <td>{formatCurrency(row?.total_amount ?? row?.amount)}</td>
                  <td><span className="admin-badge approved">{String(row?.status || "ELIGIBLE").toUpperCase()}</span></td>
                  <td>{row?.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="admin-panel admin-table-wrap">
        <div className="admin-actions mb-2" style={{ gap: 10 }}>
          <h3 style={{ margin: 0 }}>Payout Batches</h3>
          <label htmlFor="batch-status-filter">Status</label>
          <select
            id="batch-status-filter"
            className="form-select"
            style={{ maxWidth: 220 }}
            value={batchStatusFilter}
            onChange={(e) => setBatchStatusFilter(e.target.value)}
          >
            <option value="ALL">All</option>
            <option value="IN_BATCH">In Batch</option>
            <option value="EXPORTED">Exported</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
        {loading ? <p>Loading payout batches...</p> : null}
        {!loading && !filteredBatches.length ? <p className="admin-empty">No payout batches found.</p> : null}
        {!loading && filteredBatches.length ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map((batch) => {
                const status = String(batch?.status || "").toUpperCase();
                const canMarkPaid = status === "IN_BATCH" || status === "EXPORTED";
                return (
                  <tr key={batch.id}>
                    <td>{batch.id}</td>
                    <td>{formatCurrency(batch.total_amount)}</td>
                    <td><span className={`admin-badge ${status.toLowerCase()}`}>{status || "-"}</span></td>
                    <td>{batch?.created_at ? new Date(batch.created_at).toLocaleString() : "-"}</td>
                    <td>
                      <div className="admin-actions">
                        <button className="admin-btn" onClick={() => handleExport(batch.id)} disabled={saving}>
                          Export CSV
                        </button>
                        <button className="admin-btn" onClick={() => handleMarkPaid(batch.id)} disabled={saving || !canMarkPaid}>
                          Mark Paid
                        </button>
                      </div>
                    </td>
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

export default Payouts;
