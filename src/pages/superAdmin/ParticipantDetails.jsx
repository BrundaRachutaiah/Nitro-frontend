import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getParticipantById } from "../../api/admin.api";
import "./AdminPages.css";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const BANK_FIELD_CANDIDATES = [
  "bank_account_name",
  "bank_account_number",
  "bank_ifsc",
  "bank_name",
  "upi_id",
  "account_holder_name",
  "account_number",
  "ifsc_code"
];

const ParticipantDetails = () => {
  const navigate = useNavigate();
  const { participantId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDetails = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await getParticipantById(participantId);
      setData(res?.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load participant details.");
    } finally {
      setLoading(false);
    }
  }, [participantId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const bankRows = useMemo(() => {
    if (!data) return [];
    return BANK_FIELD_CANDIDATES.map((key) => ({
      key,
      label: key.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      value: data[key]
    })).filter((row) => row.value);
  }, [data]);

  const completedProducts = Array.isArray(data?.completed_products) ? data.completed_products : [];
  const summary = data?.summary || {};

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Participant Details</h1>
          <p>Profile, bank details, and completed product purchase journey</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="admin-btn" onClick={() => navigate("/super-admin/users")}>Back</button>
          <button type="button" className="admin-btn" onClick={loadDetails}>Refresh</button>
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}
      {loading ? <p>Loading participant details...</p> : null}

      {!loading && data ? (
        <>
          <section className="admin-panel participant-detail-grid">
            <article>
              <h3>Profile Information</h3>
              <div className="participant-detail-list">
                <div><strong>Name:</strong> {data?.full_name || "-"}</div>
                <div><strong>Email:</strong> {data?.email || "-"}</div>
                <div><strong>Phone:</strong> {data?.phone || "-"}</div>
                <div><strong>Status:</strong> {data?.status || "-"}</div>
                <div><strong>Joined:</strong> {formatDate(data?.created_at)}</div>
              </div>
            </article>

            <article>
              <h3>Bank Details</h3>
              {bankRows.length ? (
                <div className="participant-detail-list">
                  {bankRows.map((row) => (
                    <div key={row.key}><strong>{row.label}:</strong> {row.value}</div>
                  ))}
                </div>
              ) : (
                <p className="admin-empty">No bank details added by participant yet.</p>
              )}
            </article>
          </section>

          <section className="admin-panel participant-summary-grid">
            <article>
              <h4>Approved Applications</h4>
              <p>{summary.approved_applications || 0}</p>
            </article>
            <article>
              <h4>Approved Proofs</h4>
              <p>{summary.approved_purchase_proofs || 0}</p>
            </article>
            <article>
              <h4>Approved Reviews</h4>
              <p>{summary.approved_reviews || 0}</p>
            </article>
            <article>
              <h4>Eligible Payouts</h4>
              <p>{summary.payouts_eligible || 0}</p>
            </article>
            <article>
              <h4>Payouts Paid</h4>
              <p>{summary.payouts_paid || 0}</p>
            </article>
          </section>

          <section className="admin-panel admin-table-wrap">
            <h3>Completed Product Journey</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Product</th>
                  <th>Mode</th>
                  <th>Allocation</th>
                  <th>Purchase Proof</th>
                  <th>Review</th>
                  <th>Payout</th>
                  <th>Expected</th>
                  <th>Actual</th>
                </tr>
              </thead>
              <tbody>
                {completedProducts.length ? (
                  completedProducts.map((row) => (
                    <tr key={row.application_id}>
                      <td>{row.project_name || "-"}</td>
                      <td>{row.product_name || "-"}</td>
                      <td>{row.project_mode || "-"}</td>
                      <td>
                        <span className={`admin-badge ${String(row.allocation_status || "").toLowerCase()}`}>
                          {row.allocation_status || "-"}
                        </span>
                      </td>
                      <td>
                        <div>{row.purchase_proof_status || "-"}</div>
                        {row.purchase_proof_url ? (
                          <a href={row.purchase_proof_url} target="_blank" rel="noreferrer">View proof</a>
                        ) : null}
                      </td>
                      <td>
                        <div>{row.review_status || "-"}</div>
                        {row.review_url ? (
                          <a href={row.review_url} target="_blank" rel="noreferrer">View review</a>
                        ) : null}
                      </td>
                      <td>
                        <span className={`admin-badge ${String(row.payout_status || "").toLowerCase()}`}>
                          {row.payout_status || "NOT_ELIGIBLE"}
                        </span>
                      </td>
                      <td>{formatCurrency(row.expected_payout_amount)}</td>
                      <td>{formatCurrency(row.payout_amount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="admin-empty" colSpan={9}>No completed/approved product journey found for this participant.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </div>
  );
};

export default ParticipantDetails;
