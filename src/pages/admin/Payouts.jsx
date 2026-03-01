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
  markPayoutPaid,
} from "../../api/payout.api";
import "../superAdmin/AdminPages.css";

/* ─── Helpers ──────────────────────────────────────────────── */
const fmt = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const withTimeout = (promise, label, ms = 15000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise
      .then((v) => { clearTimeout(t); resolve(v); })
      .catch((e) => { clearTimeout(t); reject(e); });
  });

const normalizeBatchStatus = (v) => {
  const s = String(v || "").toUpperCase();
  return s === "PENDING" ? "IN_BATCH" : s;
};

const formatAddress = (g) => {
  const parts = [g.address_line1, g.address_line2, g.city, g.state, g.pincode, g.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
};

/* ─── Inline Styles ────────────────────────────────────────── */
const S = {
  page: {
    minHeight: "100vh",
    background: "#f0f4f9",
    padding: "32px 28px",
    fontFamily: "'DM Sans', 'Inter', sans-serif",
    color: "#0f1f30",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
    flexWrap: "wrap",
    gap: 14,
  },
  heading: {
    margin: 0,
    fontSize: 34,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: "#0a1929",
  },
  subheading: {
    margin: "4px 0 0",
    fontSize: 13,
    color: "#5a7898",
  },
  headerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  btn: {
    border: "1.5px solid #c5d5e8",
    background: "#fff",
    borderRadius: 10,
    height: 40,
    padding: "0 16px",
    color: "#1a3550",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #0da4ca 0%, #0882a3 100%)",
    border: "none",
    color: "#fff",
    boxShadow: "0 3px 10px rgba(13,164,202,0.35)",
  },
  btnDanger: {
    background: "linear-gradient(135deg, #e85f1e 0%, #c44e10 100%)",
    border: "none",
    color: "#fff",
    boxShadow: "0 3px 8px rgba(232,95,30,0.3)",
  },
  btnSmall: {
    height: 34,
    fontSize: 12,
    padding: "0 12px",
    borderRadius: 8,
  },
  card: {
    background: "#fff",
    border: "1px solid #dce9f5",
    borderRadius: 16,
    boxShadow: "0 2px 12px rgba(10,25,41,0.05)",
    marginBottom: 24,
    overflow: "hidden",
  },
  cardHeader: {
    padding: "18px 22px 14px",
    borderBottom: "1px solid #eef3f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  cardTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: "#0a1929",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "11px 14px",
    fontSize: 11,
    fontWeight: 700,
    color: "#4a6882",
    background: "#f7fafd",
    borderBottom: "1px solid #e8f0f8",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "13px 14px",
    fontSize: 13,
    borderBottom: "1px solid #eef3f9",
    verticalAlign: "top",
  },
  emptyState: {
    textAlign: "center",
    padding: "48px 24px",
    color: "#6b8aaa",
    fontSize: 14,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
    padding: "16px 22px",
    borderBottom: "1px solid #eef3f9",
  },
  summaryCard: {
    background: "#f7fbff",
    border: "1px solid #deeaf6",
    borderRadius: 12,
    padding: "12px 14px",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#6a8aaa",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 800,
    color: "#0a1929",
  },
  productList: {
    margin: 0,
    padding: "0 0 0 14px",
    listStyle: "decimal",
  },
  productItem: {
    padding: "2px 0",
    fontSize: 13,
    lineHeight: 1.5,
    color: "#1a3550",
  },
  batchIdMono: {
    fontFamily: "monospace",
    fontSize: 10,
    color: "#7a99b5",
    wordBreak: "break-all",
    maxWidth: 120,
    lineHeight: 1.4,
  },
  actionCell: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap",
  },
  filterRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  select: {
    border: "1.5px solid #c5d5e8",
    background: "#fff",
    borderRadius: 10,
    height: 38,
    padding: "0 14px",
    fontSize: 13,
    color: "#1a3550",
    fontWeight: 600,
    cursor: "pointer",
    outline: "none",
  },
  paidRow: {
    background: "#f4fdf6",
  },
  paidBadge: {
    background: "#d0f5e0",
    color: "#0f7a3e",
  },
  inBatchBadge: {
    background: "#fff3d6",
    color: "#9a6100",
  },
  exportedBadge: {
    background: "#e0f0ff",
    color: "#0060b8",
  },
  alert: (type) => ({
    padding: "12px 16px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 16,
    background: type === "error" ? "#fff0f0" : "#f0fff6",
    color: type === "error" ? "#c0392b" : "#1a7a42",
    border: `1px solid ${type === "error" ? "#fad0cc" : "#b0eacc"}`,
  }),
  participantName: {
    fontWeight: 700,
    fontSize: 13,
    color: "#0a1929",
  },
  participantEmail: {
    fontSize: 11,
    color: "#7a9ab5",
    marginTop: 2,
  },
  amountCell: {
    fontWeight: 800,
    fontSize: 14,
    color: "#0a1929",
    whiteSpace: "nowrap",
  },
};

const StatusBadge = ({ status }) => {
  const s = normalizeBatchStatus(status);
  const style =
    s === "PAID" ? S.paidBadge
    : s === "EXPORTED" ? S.exportedBadge
    : S.inBatchBadge;
  return <span style={{ ...S.badge, ...style }}>{s.replace("_", " ")}</span>;
};

/* ─── Main Component ─────────────────────────────────────────── */
const Payouts = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [eligibleRows, setEligibleRows] = useState([]);
  const [batchStatusFilter, setBatchStatusFilter] = useState("ALL");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedBatches, setExpandedBatches] = useState(new Set());

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
      errs.push(batchRes.reason?.message || "Failed to load payout batches.");
      setBatches([]);
    }
    if (eligibleRes.status === "fulfilled") {
      const d = eligibleRes.value?.data;
      setEligibleRows(Array.isArray(d?.data) ? d.data : []);
    } else {
      errs.push(eligibleRes.reason?.message || "Failed to load eligible payouts.");
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

  const handleExportBatch = async (batchId) => {
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
      const res = await exportBatchesCSV({ status: batchStatusFilter });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8;" }));
      const suffix = batchStatusFilter === "ALL" ? "all" : batchStatusFilter.toLowerCase();
      const a = Object.assign(document.createElement("a"), { href: url, download: `payout_batches_${suffix}.csv` });
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      setSuccess("Exported successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to export.");
    } finally { setSaving(false); }
  };

  const handleMarkPayoutPaid = async (payoutIds, participantName) => {
    setSaving(true); setError(""); setSuccess("");
    try {
      await Promise.all(payoutIds.map((id) => markPayoutPaid(id)));
      setSuccess(`Marked payout for ${participantName || "participant"} as paid.`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to mark payout as paid.");
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

  useEffect(() => { loadData(); }, []);

  /* Group eligible rows by participant */
  const groupedEligible = useMemo(() => {
    const map = new Map();
    for (const row of eligibleRows) {
      const key = row.participant_id;
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          participant_id: row.participant_id,
          profiles: row.profiles,
          products: [],
          total: 0,
          status: row.status,
          created_at: row.created_at,
        });
      }
      const entry = map.get(key);
      if (row.product_name) entry.products.push(row.product_name);
      entry.total += Number(row.allocated_budget || row.product_amount || 0);
    }
    return [...map.values()];
  }, [eligibleRows]);

  const grandTotal = useMemo(
    () => eligibleRows.reduce((s, r) => s + Number(r.allocated_budget || r.product_amount || 0), 0),
    [eligibleRows]
  );

  /* Group batch participants by participant_id within each batch */
  const filteredBatches = useMemo(
    () =>
      batchStatusFilter === "ALL"
        ? batches
        : batches.filter((b) => normalizeBatchStatus(b?.status) === batchStatusFilter),
    [batches, batchStatusFilter]
  );

  const groupParticipants = (rawParticipants) => {
    const grouped = [];
    const seen = new Map();
    for (const p of rawParticipants) {
      const pid = p.id;
      if (!seen.has(pid)) {
        seen.set(pid, {
          ...p,
          products: p.product_name ? [p.product_name] : [],
          total_amount: Number(p.product_amount || p.amount || 0),
          payout_ids: p.payout_id ? [p.payout_id] : [],
          all_paid: p.payout_status === "PAID",
        });
        grouped.push(seen.get(pid));
      } else {
        const g = seen.get(pid);
        if (p.product_name && !g.products.includes(p.product_name)) g.products.push(p.product_name);
        g.total_amount += Number(p.product_amount || p.amount || 0);
        if (p.payout_id && !g.payout_ids.includes(p.payout_id)) g.payout_ids.push(p.payout_id);
        if (p.payout_status !== "PAID") g.all_paid = false;
      }
    }
    return grouped;
  };

  const toggleBatch = (batchId) => {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  return (
    <div style={S.page}>
      {/* Page Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.heading}>Payout Batches</h1>
          <p style={S.subheading}>Review eligible payouts, create batches, export and mark paid.</p>
        </div>
        <div style={S.headerActions}>
          <button style={S.btn} onClick={() => navigate("/dashboard")}>← Back</button>
          <button style={S.btn} onClick={() => navigate("/admin/payout-history")}>Payout History</button>
          <button style={S.btn} onClick={loadData} disabled={saving}>↻ Refresh</button>
          <button
            style={{ ...S.btn, ...S.btnPrimary }}
            onClick={handleCreateBatch}
            disabled={saving || loading || !eligibleRows.length}
          >
            + Create Batch
          </button>
        </div>
      </div>

      {error && <div style={S.alert("error")}>{error}</div>}
      {success && <div style={S.alert("success")}>{success}</div>}

      {/* ─── Eligible Payouts ─────────────────────────────────── */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <h2 style={S.cardTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0da4ca" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            Eligible Payouts
            {!loading && (
              <span style={{ fontSize: 13, fontWeight: 500, color: "#5a7898", marginLeft: 4 }}>
                — {groupedEligible.length} participant{groupedEligible.length !== 1 ? "s" : ""}
              </span>
            )}
          </h2>
          {!loading && eligibleRows.length > 0 && (
            <span style={{ fontSize: 14, fontWeight: 800, color: "#0da4ca" }}>{fmt(grandTotal)} total</span>
          )}
        </div>

        {/* Summary row */}
        {!loading && eligibleRows.length > 0 && (
          <div style={S.summaryGrid}>
            <div style={S.summaryCard}>
              <div style={S.summaryLabel}>Participants</div>
              <div style={S.summaryValue}>{groupedEligible.length}</div>
            </div>
            <div style={S.summaryCard}>
              <div style={S.summaryLabel}>Products</div>
              <div style={S.summaryValue}>{eligibleRows.length}</div>
            </div>
            <div style={{ ...S.summaryCard, background: "#f0fbff", borderColor: "#b8e4f5" }}>
              <div style={S.summaryLabel}>Total Pending</div>
              <div style={{ ...S.summaryValue, color: "#0882a3" }}>{fmt(grandTotal)}</div>
            </div>
          </div>
        )}

        {loading && (
          <div style={S.emptyState}>Loading eligible payouts…</div>
        )}
        {!loading && eligibleRows.length === 0 && (
          <div style={S.emptyState}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            No eligible payouts right now. All caught up!
          </div>
        )}

        {!loading && eligibleRows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Participant</th>
                  <th style={S.th}>Products Purchased</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Amount</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Date</th>
                </tr>
              </thead>
              <tbody>
                {groupedEligible.map((row) => (
                  <tr key={row.participant_id}>
                    <td style={S.td}>
                      <div style={S.participantName}>{row.profiles?.full_name || "—"}</div>
                      <div style={S.participantEmail}>{row.profiles?.email || ""}</div>
                    </td>
                    <td style={S.td}>
                      {row.products.length === 0 && <span style={{ color: "#aab9c8" }}>—</span>}
                      {row.products.length === 1 && <span>{row.products[0]}</span>}
                      {row.products.length > 1 && (
                        <ol style={S.productList}>
                          {row.products.map((p, i) => (
                            <li key={i} style={S.productItem}>{p}</li>
                          ))}
                        </ol>
                      )}
                    </td>
                    <td style={{ ...S.td, textAlign: "right", ...S.amountCell }}>{fmt(row.total)}</td>
                    <td style={S.td}>
                      <span style={{ ...S.badge, background: "#e0f9ec", color: "#0c6e3a" }}>ELIGIBLE</span>
                    </td>
                    <td style={{ ...S.td, fontSize: 12, color: "#7a99b5", whiteSpace: "nowrap" }}>
                      {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Payout Batches ────────────────────────────────────── */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <h2 style={S.cardTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0da4ca" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            Payout Batches
          </h2>
          <div style={S.filterRow}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#4a6882" }}>Status</label>
            <select
              style={S.select}
              value={batchStatusFilter}
              onChange={(e) => setBatchStatusFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="IN_BATCH">In Batch</option>
              <option value="EXPORTED">Exported</option>
              <option value="PAID">Paid</option>
            </select>
            <button
              style={{ ...S.btn, ...S.btnSmall }}
              onClick={handleExportFiltered}
              disabled={saving || loading || !filteredBatches.length}
            >
              ↓ Export Filtered
            </button>
          </div>
        </div>

        {loading && <div style={S.emptyState}>Loading payout batches…</div>}
        {!loading && filteredBatches.length === 0 && (
          <div style={S.emptyState}>No payout batches found.</div>
        )}

        {!loading && filteredBatches.length > 0 && (
          <div>
            {filteredBatches.map((batch) => {
              const batchStatus = normalizeBatchStatus(batch?.status);
              const isPaidBatch = batchStatus === "PAID";
              const rawParticipants = Array.isArray(batch?.participants) ? batch.participants : [];
              const grouped = groupParticipants(rawParticipants);
              const isExpanded = expandedBatches.has(batch.id);
              const batchTotal = grouped.reduce((s, g) => s + (g.total_amount || 0), 0);

              return (
                <div
                  key={batch.id}
                  style={{
                    borderBottom: "1px solid #eef3f9",
                    background: isPaidBatch ? "#f9fdf9" : "#fff",
                  }}
                >
                  {/* Batch summary row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "14px 18px",
                      gap: 14,
                      cursor: grouped.length > 0 ? "pointer" : "default",
                      flexWrap: "wrap",
                    }}
                    onClick={() => grouped.length > 0 && toggleBatch(batch.id)}
                  >
                    {/* Expand arrow */}
                    {grouped.length > 0 && (
                      <span style={{
                        fontSize: 12,
                        color: "#7a99b5",
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                        display: "inline-block",
                        width: 16,
                        flexShrink: 0,
                      }}>▶</span>
                    )}
                    {grouped.length === 0 && <span style={{ width: 16, flexShrink: 0 }} />}

                    {/* Batch ID */}
                    <div style={{ ...S.batchIdMono, minWidth: 120 }}>{batch.id}</div>

                    {/* Participant summary */}
                    <div style={{ flex: 1, minWidth: 120 }}>
                      {grouped.length === 0 ? (
                        <span style={{ fontSize: 13, color: "#aab9c8" }}>No participants</span>
                      ) : (
                        <div style={S.participantName}>
                          {grouped[0].full_name || grouped[0].email || "—"}
                          {grouped.length > 1 && (
                            <span style={{ fontWeight: 400, color: "#7a99b5", marginLeft: 6 }}>
                              +{grouped.length - 1} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Product count */}
                    <div style={{ fontSize: 12, color: "#5a7898", minWidth: 80 }}>
                      {grouped.reduce((s, g) => s + g.products.length, 0)} product{grouped.reduce((s, g) => s + g.products.length, 0) !== 1 ? "s" : ""}
                    </div>

                    {/* Total */}
                    <div style={{ ...S.amountCell, minWidth: 90 }}>
                      {batchTotal > 0 ? fmt(batchTotal) : fmt(batch.total_amount)}
                    </div>

                    {/* Status */}
                    <StatusBadge status={batch.status} />

                    {/* Date */}
                    <div style={{ fontSize: 12, color: "#7a99b5", whiteSpace: "nowrap" }}>
                      {batch.created_at ? new Date(batch.created_at).toLocaleString() : "—"}
                    </div>

                    {/* Batch-level actions */}
                    <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      {!isPaidBatch && (
                        <>
                          <button
                            style={{ ...S.btn, ...S.btnSmall }}
                            onClick={() => handleExportBatch(batch.id)}
                            disabled={saving}
                          >
                            ↓ Export All
                          </button>
                          <button
                            style={{ ...S.btn, ...S.btnSmall, ...S.btnPrimary }}
                            onClick={() => handleMarkPaid(batch.id)}
                            disabled={saving}
                          >
                            Mark All Paid
                          </button>
                        </>
                      )}
                      {isPaidBatch && (
                        <span style={{ ...S.badge, ...S.paidBadge, fontSize: 11 }}>✓ PAID</span>
                      )}
                    </div>
                  </div>

                  {/* Expanded participants table */}
                  {isExpanded && grouped.length > 0 && (
                    <div style={{ background: "#f7fafd", borderTop: "1px solid #e8f0f8" }}>
                      <table style={{ ...S.table }}>
                        <thead>
                          <tr>
                            <th style={{ ...S.th, paddingLeft: 48 }}>Participant</th>
                            <th style={S.th}>Products Purchased</th>
                            <th style={{ ...S.th, textAlign: "right" }}>Amount</th>
                            <th style={S.th}>Account No.</th>
                            <th style={S.th}>IFSC</th>
                            <th style={S.th}>Address</th>
                            <th style={S.th}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grouped.map((g, idx) => {
                            const isPaid = g.all_paid || isPaidBatch;
                            return (
                              <tr key={`${batch.id}-${g.id || idx}`} style={isPaid ? S.paidRow : { background: "#fff" }}>
                                <td style={{ ...S.td, paddingLeft: 48 }}>
                                  <div style={S.participantName}>{g.full_name || "—"}</div>
                                  <div style={S.participantEmail}>{g.email || ""}</div>
                                </td>
                                <td style={S.td}>
                                  {g.products.length === 0 && <span style={{ color: "#aab9c8" }}>—</span>}
                                  {g.products.length === 1 && <span style={{ fontSize: 13 }}>{g.products[0]}</span>}
                                  {g.products.length > 1 && (
                                    <ol style={S.productList}>
                                      {g.products.map((name, i) => (
                                        <li key={i} style={S.productItem}>{name}</li>
                                      ))}
                                    </ol>
                                  )}
                                </td>
                                <td style={{ ...S.td, textAlign: "right", ...S.amountCell }}>
                                  {g.total_amount > 0 ? fmt(g.total_amount) : "—"}
                                </td>
                                <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12 }}>
                                  {g.bank_account_number || "—"}
                                </td>
                                <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12 }}>
                                  {g.bank_ifsc || "—"}
                                </td>
                                <td style={{ ...S.td, fontSize: 12, color: "#5a7898", maxWidth: 220 }}>
                                  {formatAddress(g)}
                                </td>
                                <td style={S.td}>
                                  {isPaid ? (
                                    <span style={{ ...S.badge, ...S.paidBadge, fontSize: 11 }}>✓ PAID</span>
                                  ) : (
                                    <div style={S.actionCell}>
                                      <button
                                        style={{ ...S.btn, ...S.btnSmall }}
                                        onClick={() => handleExportPayout(g.payout_ids?.[0], g.full_name)}
                                        disabled={saving || !g.payout_ids?.length}
                                      >
                                        ↓ Export
                                      </button>
                                      <button
                                        style={{ ...S.btn, ...S.btnSmall, ...S.btnPrimary }}
                                        onClick={() => handleMarkPayoutPaid(g.payout_ids, g.full_name)}
                                        disabled={saving || !g.payout_ids?.length}
                                      >
                                        Mark Paid
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {/* Total row */}
                        <tfoot>
                          <tr>
                            <td colSpan={2} style={{ ...S.td, paddingLeft: 48, fontSize: 12, color: "#7a99b5", fontWeight: 700 }}>
                              Batch Total
                            </td>
                            <td style={{ ...S.td, textAlign: "right", fontWeight: 800, fontSize: 14, color: "#0882a3" }}>
                              {fmt(batchTotal || batch.total_amount)}
                            </td>
                            <td colSpan={4} style={S.td} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Payouts;