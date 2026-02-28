import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createBatch,
  exportBatchesCSV,
  exportBatchCSV,
  exportPayoutCSV,
  getBatches,
  getEligiblePayouts,
  markBatchPaid,
  markPayoutPaid
} from "../../api/payout.api";
import "../superAdmin/AdminPages.css";

/* ─── helpers ─────────────────────────────────────────────── */
const fmt = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const withTimeout = (promise, label, ms = 15000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); })
           .catch((e) => { clearTimeout(t); reject(e); });
  });

const normalizeBatchStatus = (v) => {
  const s = String(v || "").toUpperCase();
  return s === "PENDING" ? "IN_BATCH" : s;
};

/* ─── Budget progress bar ──────────────────────────────────── */
const BudgetBar = ({ spent, total }) => {
  if (!total || total <= 0) return null;
  const pct = Math.min(100, Math.round((spent / total) * 100));
  const color = pct >= 90 ? "#dc2626" : pct >= 70 ? "#d97706" : "#16a34a";
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 6, background: "#e5edf6", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.3s" }} />
      </div>
      <div style={{ fontSize: 11, color: "#6b7f94", marginTop: 3 }}>{pct}% of budget used</div>
    </div>
  );
};

/* ─── Brand Budget Card ─────────────────────────────────────── */
const BrandBudgetCard = ({ brand, isSelected, onClick }) => {
  const remaining = brand.remaining_budget;
  const hasOverflow = remaining !== null && brand.pending_payout_total > remaining;
  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? "#f0f9ff" : "#fff",
        border: `2px solid ${isSelected ? "#0da4ca" : "#d6e2ee"}`,
        borderRadius: 12,
        padding: "14px 16px",
        minWidth: 210,
        cursor: "pointer",
        transition: "all 0.15s",
        flex: "1 1 210px",
        maxWidth: 280,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, color: "#10243a" }}>
        {brand.client_name}
      </div>
      <div style={{ fontSize: 12, color: "#6b7f94", marginBottom: 10 }}>
        {brand.project_count} project{brand.project_count !== 1 ? "s" : ""} · {brand.payout_count} pending payout{brand.payout_count !== 1 ? "s" : ""}
      </div>
      {brand.total_budget > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
          <span style={{ color: "#555" }}>Total Budget</span>
          <span style={{ fontWeight: 600 }}>{fmt(brand.total_budget)}</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: "#555" }}>Allocated (Spent)</span>
        <span style={{ fontWeight: 600 }}>{fmt(brand.spent_budget)}</span>
      </div>
      {remaining !== null && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: "#555" }}>Remaining Budget</span>
          <span style={{ fontWeight: 700, color: remaining > 0 ? "#16a34a" : "#dc2626" }}>{fmt(remaining)}</span>
        </div>
      )}
      <BudgetBar spent={brand.spent_budget} total={brand.total_budget} />
      <div style={{
        display: "flex", justifyContent: "space-between", fontSize: 12,
        marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5edf6"
      }}>
        <span style={{ color: "#555" }}>Pending Payouts</span>
        <span style={{ fontWeight: 700, color: hasOverflow ? "#dc2626" : "#0da4ca" }}>
          {fmt(brand.pending_payout_total)}
          {hasOverflow ? " ⚠️" : ""}
        </span>
      </div>
    </div>
  );
};

/* ─── Main Component ─────────────────────────────────────────── */
const Payouts = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [eligibleRows, setEligibleRows] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ projects: [], clients: [] });
  const [batchStatusFilter, setBatchStatusFilter] = useState("ALL");
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = async () => {
    setError(""); setSuccess(""); setLoading(true);
    const [batchRes, eligibleRes] = await Promise.allSettled([
      withTimeout(getBatches({ status: "ALL", limit: 200 }), "Payout batches"),
      withTimeout(getEligiblePayouts(), "Eligible payouts"),
    ]);
    const errs = [];
    if (batchRes.status === "fulfilled") {
      setBatches(Array.isArray(batchRes.value?.data?.data) ? batchRes.value.data.data : []);
    } else {
      errs.push(batchRes.reason?.response?.data?.message || batchRes.reason?.message || "Failed to load payout batches.");
      setBatches([]);
    }
    if (eligibleRes.status === "fulfilled") {
      const d = eligibleRes.value?.data;
      setEligibleRows(Array.isArray(d?.data) ? d.data : []);
      if (d?.meta?.filter_options) setFilterOptions(d.meta.filter_options);
    } else {
      errs.push(eligibleRes.reason?.response?.data?.message || eligibleRes.reason?.message || "Failed to load eligible payouts.");
      setEligibleRows([]);
    }
    if (errs.length) setError(errs.join(" "));
    setLoading(false);
  };

  const handleCreateBatch = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await createBatch({});
      setSuccess(res?.data?.message || "Payout batch created successfully.");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create payout batch.");
    } finally { setSaving(false); }
  };

  const handleMarkPaid = async (batchId) => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await markBatchPaid(batchId);
      setSuccess(res?.data?.message || "Batch marked as paid.");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to mark batch as paid.");
    } finally { setSaving(false); }
  };

  const handleExport = async (batchId) => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await exportBatchCSV(batchId);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8;" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `payout_batch_${batchId}.csv` });
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to export payout batch.");
    } finally { setSaving(false); }
  };

  const handleExportFiltered = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const exportStatus = batchStatusFilter === "ALL" ? "ALL" : batchStatusFilter;
      const res = await exportBatchesCSV({ status: exportStatus });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8;" }));
      const suffix = batchStatusFilter === "ALL" ? "all" : batchStatusFilter.toLowerCase();
      const a = Object.assign(document.createElement("a"), { href: url, download: `payout_batches_${suffix}.csv` });
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      setSuccess("Exported successfully.");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to export.");
    } finally { setSaving(false); }
  };

  const handleExportPayout = async (payoutId, participantName) => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await exportPayoutCSV(payoutId);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8;" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `payout_${participantName || payoutId}.csv` });
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      setSuccess(`Exported payout for ${participantName || payoutId}.`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to export payout.");
    } finally { setSaving(false); }
  };

  const handleMarkPayoutPaid = async (payoutId, participantName) => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await markPayoutPaid(payoutId);
      setSuccess(res?.data?.message || `Marked payout for ${participantName || payoutId} as paid.`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to mark payout as paid.");
    } finally { setSaving(false); }
  };

  useEffect(() => { loadData(); }, []);

  /* brand summaries — always from all eligible rows */
  const brandSummaries = useMemo(() => {
    const map = new Map();
    for (const row of eligibleRows) {
      const cid = row?.client?.id;
      if (!cid) continue;
      if (!map.has(cid)) {
        const budget = row?.project_budget;
        map.set(cid, {
          client_id: cid,
          client_name: row?.client?.full_name || row?.client?.email || cid,
          total_budget: budget?.total_budget ?? 0,
          spent_budget: budget?.spent_budget ?? 0,
          remaining_budget: budget?.remaining_budget ?? null,
          pending_payout_total: 0,
          payout_count: 0,
          project_count: new Set(),
        });
      }
      const entry = map.get(cid);
      entry.pending_payout_total += Number(row.total_amount || 0);
      entry.payout_count += 1;
      if (row.project_id) entry.project_count.add(row.project_id);
    }
    return [...map.values()].map((e) => ({ ...e, project_count: e.project_count.size }));
  }, [eligibleRows]);

  /* filtered rows */
  const filteredEligibleRows = useMemo(() => {
    let rows = eligibleRows;
    if (selectedClientId) rows = rows.filter((r) => r?.client?.id === selectedClientId);
    if (selectedProjectId) rows = rows.filter((r) => r?.project_id === selectedProjectId);
    return rows;
  }, [eligibleRows, selectedClientId, selectedProjectId]);

  /* group by participant — sum product amounts only, collect all products */
  const groupedEligibleRows = useMemo(() => {
    const map = new Map();
    for (const row of filteredEligibleRows) {
      const key = row.participant_id;
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          id: row.id,
          participant_id: row.participant_id,
          profiles: row.profiles,
          status: row.status,
          created_at: row.created_at,
          products: [],
          product_amount_total: 0,
        });
      }
      const entry = map.get(key);
      if (row.product_name) entry.products.push(row.product_name);
      // use allocated_budget if set, otherwise product_amount
      entry.product_amount_total += Number(row.allocated_budget || row.product_amount || 0);
      if (row.created_at && (!entry.created_at || row.created_at < entry.created_at)) {
        entry.created_at = row.created_at;
      }
    }
    return [...map.values()];
  }, [filteredEligibleRows]);

  /* projects for selected brand */
  const availableProjects = useMemo(() => {
    if (!selectedClientId) return filterOptions.projects || [];
    return (filterOptions.projects || []).filter((p) => p.client_id === selectedClientId);
  }, [filterOptions.projects, selectedClientId]);

  const selectedBrand = useMemo(() =>
    selectedClientId ? brandSummaries.find((b) => b.client_id === selectedClientId) : null,
    [brandSummaries, selectedClientId]
  );

  const filteredBatches = useMemo(() =>
    batchStatusFilter === "ALL" ? batches
      : batches.filter((b) => normalizeBatchStatus(b?.status) === batchStatusFilter),
    [batches, batchStatusFilter]
  );

  const showActionsColumn = useMemo(() =>
    filteredBatches.some((b) => normalizeBatchStatus(b?.status) !== "PAID"),
    [filteredBatches]
  );

  const grandTotal = useMemo(() =>
    eligibleRows.reduce((s, r) => s + Number(r.allocated_budget || r.product_amount || 0), 0),
    [eligibleRows]
  );

  const participantCount = useMemo(() => {
    const ids = new Set(eligibleRows.map((r) => r.participant_id).filter(Boolean));
    return ids.size;
  }, [eligibleRows]);

  return (
    <div className="admin-page">
      {/* Page header */}
      <div className="admin-page-head">
        <div>
          <h1>Payout Batches</h1>
          <p>Review eligible payouts, create payout batches, export and mark paid.</p>
        </div>
        <div className="admin-head-actions">
          <button className="admin-btn" onClick={() => navigate("/dashboard")}>Back</button>
          <button className="admin-btn" onClick={() => navigate("/admin/payout-history")}>Payout History</button>
          <button className="admin-btn" onClick={loadData} disabled={saving}>Refresh</button>
          <button
            className="admin-btn primary"
            onClick={handleCreateBatch}
            disabled={saving || loading || !eligibleRows.length}
          >
            + Create Batch
          </button>
        </div>
      </div>

      {error && <p className="admin-error">{error}</p>}
      {success && <p className="admin-success">{success}</p>}

      {/* Eligible Payouts Section */}
      <section className="admin-panel admin-table-wrap mb-3">

        {/* Section title */}
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>
            Eligible Payouts
            {!loading && (
              <span style={{ fontSize: 14, fontWeight: 400, color: "#50667d", marginLeft: 8 }}>
                {participantCount} participant{participantCount !== 1 ? "s" : ""} &nbsp;·&nbsp; {fmt(grandTotal)} total pending
              </span>
            )}
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7f94" }}>
            These participants have purchased their product and completed all tasks — they are ready to be paid.
          </p>
        </div>

        {loading && <p style={{ color: "#6b7f94" }}>Loading eligible payouts…</p>}

        {!loading && eligibleRows.length === 0 && (
          <p className="admin-empty">No eligible payouts right now.</p>
        )}

        {!loading && eligibleRows.length > 0 && (
          <>
            {/* Payout Table */}
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Product Purchased</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {groupedEligibleRows.map((row) => (
                  <tr key={row.participant_id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {row?.profiles?.full_name || "-"}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7f94" }}>
                        {row?.profiles?.email || ""}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, maxWidth: 320 }}>
                      {row.products.length === 0 && "-"}
                      {row.products.length === 1 && row.products[0]}
                      {row.products.length > 1 && (
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {row.products.map((p, i) => (
                            <li key={i} style={{ marginBottom: 2 }}>{p}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, fontSize: 13 }}>
                      {fmt(row.product_amount_total)}
                    </td>
                    <td>
                      <span className="admin-badge approved">
                        {String(row?.status || "ELIGIBLE").toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "#6b7f94", whiteSpace: "nowrap" }}>
                      {row?.created_at ? new Date(row.created_at).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      {/* Payout Batches Section */}
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
          </select>
          <button
            className="admin-btn"
            onClick={handleExportFiltered}
            disabled={saving || loading || !filteredBatches.length}
          >
            Export Filtered
          </button>
        </div>

        {loading && <p>Loading payout batches…</p>}
        {!loading && !filteredBatches.length && <p className="admin-empty">No payout batches found.</p>}
        {!loading && filteredBatches.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Participant</th>
                <th>Products</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Account Number</th>
                <th>IFSC</th>
                <th>Address</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map((batch) => {
                const batchStatus = normalizeBatchStatus(batch?.status);
                const participants = Array.isArray(batch?.participants) ? batch.participants : [];
                return participants.map((p, idx) => {
                  const isPaid = (p.payout_status || normalizeBatchStatus(batchStatus)) === "PAID";
                  return (
                    <tr key={`${batch.id}-${p.payout_id || idx}`} style={{ background: isPaid ? "#f8fef8" : undefined }}>
                      {idx === 0 && (
                        <td rowSpan={participants.length} style={{ verticalAlign: "top", fontFamily: "monospace", fontSize: 11, color: "#6b7f94", wordBreak: "break-all", maxWidth: 120 }}>
                          {batch.id}
                        </td>
                      )}
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{p.full_name || "-"}</div>
                        <div style={{ fontSize: 11, color: "#6b7f94" }}>{p.email || ""}</div>
                      </td>
                      <td style={{ maxWidth: 280 }}>
                        {!p.product_name ? (
                          <span style={{ color: "#9eb4c8", fontSize: 13 }}>-</span>
                        ) : (
                          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                            {(Array.isArray(p.product_name) ? p.product_name : [p.product_name]).map((name, i) => (
                              <li key={i} style={{ marginBottom: 3, lineHeight: 1.4 }}>{name}</li>
                            ))}
                          </ol>
                        )}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, fontSize: 13 }}>
                        {p.product_amount ? fmt(p.product_amount) : "-"}
                      </td>
                      <td style={{ fontSize: 13 }}>{p.bank_account_number || "-"}</td>
                      <td style={{ fontSize: 13 }}>{p.bank_ifsc || "-"}</td>
                      <td style={{ fontSize: 12, color: "#6b7f94", maxWidth: 200 }}>
                        {[p.address_line1, p.address_line2, p.city, p.state, p.pincode, p.country].filter(Boolean).join(", ") || "-"}
                      </td>
                      {idx === 0 && (
                        <td rowSpan={participants.length} style={{ verticalAlign: "top" }}>
                          <span className={`admin-badge ${batchStatus.toLowerCase()}`}>{batchStatus}</span>
                        </td>
                      )}
                      {idx === 0 && (
                        <td rowSpan={participants.length} style={{ verticalAlign: "top", fontSize: 12, color: "#6b7f94", whiteSpace: "nowrap" }}>
                          {batch?.created_at ? new Date(batch.created_at).toLocaleString() : "-"}
                        </td>
                      )}
                      <td>
                        {isPaid ? (
                          <span className="admin-badge paid" style={{ fontSize: 11 }}>PAID</span>
                        ) : (
                          <div className="admin-actions" style={{ gap: 6 }}>
                            {p.payout_id && (
                              <button
                                className="admin-btn"
                                style={{ fontSize: 12, padding: "4px 10px", height: "auto" }}
                                onClick={() => handleExportPayout(p.payout_id, p.full_name)}
                                disabled={saving}
                              >
                                Export
                              </button>
                            )}
                            {p.payout_id && (
                              <button
                                className="admin-btn primary"
                                style={{ fontSize: 12, padding: "4px 10px", height: "auto" }}
                                onClick={() => handleMarkPayoutPaid(p.payout_id, p.full_name)}
                                disabled={saving}
                              >
                                Mark Paid
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default Payouts;