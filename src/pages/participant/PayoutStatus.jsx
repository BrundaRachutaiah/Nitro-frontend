import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axiosInstance";
import "./PayoutStatus.css";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const fmt = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
};

const STATUS_META = {
  PENDING:  { label: "Under Review", cls: "status-pending",  icon: "⏳" },
  ELIGIBLE: { label: "Approved",     cls: "status-eligible", icon: "✅" },
  APPROVED: { label: "Approved",     cls: "status-approved", icon: "✅" },
  IN_BATCH: { label: "Processing",   cls: "status-in_batch", icon: "🔄" },
  EXPORTED: { label: "Processing",   cls: "status-exported", icon: "🔄" },
  PAID:     { label: "Paid",         cls: "status-paid",     icon: "💸" },
  REJECTED: { label: "Not Approved", cls: "status-rejected", icon: "✕"  },
  FAILED:   { label: "Failed",       cls: "status-failed",   icon: "✕"  },
};

const getStatusMeta = (raw) =>
  STATUS_META[String(raw || "").toUpperCase()] ||
  { label: raw || "Pending", cls: "status-pending", icon: "⏳" };

/* ── Awaiting state — shown when no payout records exist yet ── */
const AwaitingPane = () => (
  <div className="pp-awaiting">
    <div className="pp-awaiting-icon">📬</div>
    <h2 className="pp-awaiting-title">Your submissions are under review</h2>
    <p className="pp-awaiting-body">
      Our team is currently reviewing your invoice and review submissions.
      Once everything is verified and approved, your reimbursement will be
      scheduled for transfer.
    </p>

    <div className="pp-awaiting-steps">
      <div className="pp-awaiting-step">
        <span className="pp-awaiting-step-dot pp-dot--done">✓</span>
        <span>Invoice &amp; review submitted</span>
      </div>
      <div className="pp-awaiting-step">
        <span className="pp-awaiting-step-dot pp-dot--active">⏳</span>
        <span>Admin review in progress</span>
      </div>
      <div className="pp-awaiting-step">
        <span className="pp-awaiting-step-dot pp-dot--pending">○</span>
        <span>Payout approved &amp; scheduled</span>
      </div>
      <div className="pp-awaiting-step">
        <span className="pp-awaiting-step-dot pp-dot--pending">○</span>
        <span>Reimbursement transferred to your account</span>
      </div>
    </div>

    <div className="pp-awaiting-notice">
      <span className="pp-notice-icon">✉️</span>
      <p>
        You will receive an <strong>email notification</strong> as soon as your
        payout is approved and ready for transfer. Once you get that email,
        come back to this page to check your payment details and transfer status.
      </p>
    </div>
  </div>
);

const PayoutStatus = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const P = {
    dash:    id ? `/participant/${id}/dashboard`         : "/dashboard",
    tasks:   id ? `/participant/${id}/allocation/active` : "/dashboard",
    payouts: id ? `/participant/${id}/payouts`           : "/dashboard",
  };

  const loadPayouts = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get("/admin/payouts/my");
      setData(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load payout history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPayouts(); }, []);

  const summary = useMemo(() => {
    const total = data.reduce((s, i) => s + Number(i?.product_amount || 0), 0);
    const paid  = data
      .filter((i) => String(i?.status || "").toUpperCase() === "PAID")
      .reduce((s, i) => s + Number(i?.product_amount || 0), 0);
    return { total, paid, pending: Math.max(0, total - paid) };
  }, [data]);

  const hasPayoutRecords = data.length > 0;

  return (
    <div className="participant-payout-page">
      <header className="participant-payout-topbar">
        <div className="participant-payout-brand">Nitro</div>
        <nav>
          <button type="button" onClick={() => navigate(P.dash)}>Dashboard</button>
          <button type="button" onClick={() => navigate(P.tasks)}>My Tasks</button>
          <button type="button" className="active" onClick={() => navigate(P.payouts)}>Payouts</button>
        </nav>
      </header>

      <main className="participant-payout-main">
        <section className="participant-payout-head">
          <div>
            <h1>My Payouts</h1>
            <p>Track your reimbursement status and payment history.</p>
          </div>
          <button type="button" className="pp-refresh-btn" onClick={loadPayouts}>↻ Refresh</button>
        </section>

        {error && <div className="participant-payout-error">{error}</div>}

        {loading && (
          <div className="pp-loading">
            <div className="pp-spinner" />
            <span>Loading your payout details…</span>
          </div>
        )}

        {!loading && !hasPayoutRecords && <AwaitingPane />}

        {!loading && hasPayoutRecords && (
          <>
            <section className="participant-payout-cards">
              <article>
                <h2>Total Reimbursement</h2>
                <p>{formatCurrency(summary.total)}</p>
              </article>
              <article>
                <h2>Paid Out</h2>
                <p>{formatCurrency(summary.paid)}</p>
              </article>
              <article>
                <h2>Pending Transfer</h2>
                <p>{formatCurrency(summary.pending)}</p>
              </article>
            </section>

            <section className="participant-payout-table-card">
              <h2>Payout Details</h2>
              <div className="participant-payout-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Note</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((item) => {
                      const title = item?.projects?.title || item?.projects?.name || "Campaign";
                      const { label, cls, icon } = getStatusMeta(item?.status);
                      return (
                        <tr key={item.id}>
                          <td>{title}</td>
                          <td className="pp-amount">{formatCurrency(item?.product_amount)}</td>
                          <td>
                            <span className={`participant-payout-status ${cls}`}>
                              {icon} {label}
                            </span>
                          </td>
                          <td className="pp-note">{item?.eligibility_reason || "—"}</td>
                          <td>{fmt(item?.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pp-table-notice">
                <span>✉️</span>
                <p>
                  You will be notified by <strong>email</strong> once your payout is
                  approved and the transfer is initiated. If you have any questions,
                  please reach out to our support team.
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default PayoutStatus;