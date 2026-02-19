import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { exportPayoutReportCSV, getPayoutReport } from "../../api/admin.api";
import "./AdminPages.css";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));

const Reports = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [projectCatalog, setProjectCatalog] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [paidFilter, setPaidFilter] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        paid: paidFilter
      };
      if (projectFilter !== "ALL") {
        params.projectId = projectFilter;
      }
      const res = await getPayoutReport(params);
      const reportRows = Array.isArray(res?.data?.data) ? res.data.data : [];
      setRows(reportRows);
      setProjectCatalog((prev) => {
        const map = new Map((prev || []).map((item) => [item.id, item.label]));
        for (const row of reportRows) {
          if (row?.project_id) {
            map.set(row.project_id, row.project_name || row.project_id);
          }
        }
        return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
      });
      setSummary(res?.data?.summary || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, [paidFilter, projectFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const projectOptions = useMemo(() => projectCatalog, [projectCatalog]);

  const handleExport = async () => {
    try {
      const params = {
        paid: paidFilter
      };
      if (projectFilter !== "ALL") {
        params.projectId = projectFilter;
      }
      const res = await exportPayoutReportCSV(params);
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `super_admin_payout_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to export report.");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Payout Reports</h1>
          <p>Project-wise purchase and payout report with participant payment details</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="admin-btn" onClick={() => navigate(-1)}>Back</button>
          <button type="button" className="admin-btn" onClick={load}>Refresh</button>
          <button type="button" className="admin-btn primary" onClick={handleExport}>Export CSV</button>
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-panel mb-3">
        <h3 className="mb-2">Filters</h3>
        <div className="admin-actions" style={{ gap: 10 }}>
          <label htmlFor="paid-filter">Paid Status</label>
          <select
            id="paid-filter"
            className="form-select"
            style={{ maxWidth: 220 }}
            value={paidFilter}
            onChange={(e) => setPaidFilter(e.target.value)}
          >
            <option value="ALL">All</option>
            <option value="PAID">Paid</option>
            <option value="NOT_PAID">Not Paid</option>
          </select>

          <label htmlFor="project-filter">Project</label>
          <select
            id="project-filter"
            className="form-select"
            style={{ maxWidth: 320 }}
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="ALL">All Projects</option>
            {projectOptions.map((row) => (
              <option key={row.id} value={row.id}>{row.label}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="admin-panel participant-summary-grid">
        <article>
          <h4>Rows</h4>
          <p>{summary?.total_rows || 0}</p>
        </article>
        <article>
          <h4>Total Amount</h4>
          <p>{formatCurrency(summary?.total_amount || 0)}</p>
        </article>
        <article>
          <h4>Paid</h4>
          <p>{summary?.paid_count || 0}</p>
        </article>
        <article>
          <h4>Not Paid</h4>
          <p>{summary?.unpaid_count || 0}</p>
        </article>
      </section>

      <section className="admin-panel admin-table-wrap" style={{ marginTop: 16 }}>
        <h3>Payout Report Table</h3>
        {loading ? <p>Loading report rows...</p> : null}
        {!loading && !rows.length ? <p className="admin-empty">No report data for selected filters.</p> : null}
        {!loading && rows.length ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Product</th>
                <th>Participant</th>
                <th>Email</th>
                <th>Product Amount</th>
                <th>Account Number</th>
                <th>IFSC</th>
                <th>Payout Amount</th>
                <th>Status</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.payout_id}>
                  <td>{row.project_name || "-"}</td>
                  <td>{row.product_name || "-"}</td>
                  <td>{row.participant_name || "-"}</td>
                  <td>{row.participant_email || "-"}</td>
                  <td>{formatCurrency(row.product_amount)}</td>
                  <td>{row.bank_account_number || "-"}</td>
                  <td>{row.bank_ifsc || "-"}</td>
                  <td>{formatCurrency(row.payout_amount)}</td>
                  <td>
                    <span className={`admin-badge ${String(row.payout_status || "").toLowerCase()}`}>
                      {row.payout_status || "-"}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge ${row.paid_status === "PAID" ? "paid" : "pending"}`}>
                      {row.paid_status || "-"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
};

export default Reports;
