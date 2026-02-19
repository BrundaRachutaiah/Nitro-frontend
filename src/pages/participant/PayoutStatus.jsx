import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axiosInstance";
import "./PayoutStatus.css";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));

const PayoutStatus = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const participantDashboardPath = id ? `/participant/${id}/dashboard` : "/dashboard";
  const participantAllocationPath = id ? `/participant/${id}/allocation/active` : "/dashboard";
  const participantPayoutPath = id ? `/participant/${id}/payouts` : "/dashboard";

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

  useEffect(() => {
    loadPayouts();
  }, []);

  const summary = useMemo(() => {
    const total = data.reduce((sum, item) => sum + Number((item?.total_amount ?? item?.amount) || 0), 0);
    const paid = data
      .filter((item) => String(item?.status || "").toUpperCase() === "PAID")
      .reduce((sum, item) => sum + Number((item?.total_amount ?? item?.amount) || 0), 0);
    const pending = Math.max(0, total - paid);
    return { total, paid, pending };
  }, [data]);

  return (
    <div className="participant-payout-page">
      <header className="participant-payout-topbar">
        <div className="participant-payout-brand">Nitro</div>
        <nav>
          <button type="button" onClick={() => navigate(participantDashboardPath)}>Dashboard</button>
          <button type="button" onClick={() => navigate(participantAllocationPath)}>Allocations</button>
          <button type="button" className="active" onClick={() => navigate(participantPayoutPath)}>Payouts</button>
        </nav>
      </header>

      <main className="participant-payout-main">
        <section className="participant-payout-head">
          <div>
            <h1>Payout Status</h1>
            <p>Track approved, pending, and processed payouts.</p>
          </div>
          <button type="button" onClick={loadPayouts}>Refresh</button>
        </section>

        {error ? <div className="participant-payout-error">{error}</div> : null}

        <section className="participant-payout-cards">
          <article>
            <h2>Total Earned</h2>
            <p>{formatCurrency(summary.total)}</p>
          </article>
          <article>
            <h2>Paid Out</h2>
            <p>{formatCurrency(summary.paid)}</p>
          </article>
          <article>
            <h2>Pending</h2>
            <p>{formatCurrency(summary.pending)}</p>
          </article>
        </section>

        <section className="participant-payout-table-card">
          <h2>Payout History</h2>
          {loading ? <p className="participant-payout-loading">Loading payout entries...</p> : null}
          {!loading && !data.length ? <p className="participant-payout-empty">No payout records yet.</p> : null}
          {!loading && data.length ? (
            <div className="participant-payout-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Reward</th>
                    <th>Product</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Batch</th>
                    <th>Note</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => {
                    const projectTitle = item?.projects?.title || item?.projects?.name || "Project";
                    const status = String(item?.status || "PENDING").toUpperCase();
                    return (
                      <tr key={item.id}>
                        <td>{projectTitle}</td>
                        <td>{formatCurrency(item?.reward_amount)}</td>
                        <td>{formatCurrency(item?.product_amount)}</td>
                        <td>{formatCurrency(item?.total_amount ?? item?.amount)}</td>
                        <td>
                          <span className={`participant-payout-status status-${status.toLowerCase()}`}>{status}</span>
                        </td>
                        <td>{item?.payout_batch_id || "-"}</td>
                        <td>{item?.eligibility_reason || "-"}</td>
                        <td>{item?.created_at ? new Date(item.created_at).toLocaleString() : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
};

export default PayoutStatus;
