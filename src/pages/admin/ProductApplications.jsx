import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  approveProductApplication,
  getProductApplications,
  rejectProductApplication
} from "../../api/admin.api";

const normalize = (value) => String(value || "").trim().toLowerCase();
const toAmount = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};
const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(toAmount(value));
const getAutoAllocatedBudget = (row) =>
  toAmount(row?.suggested_allocated_budget ?? row?.requested_amount);
const formatStatusLabel = (status) => {
  const value = String(status || "").toUpperCase();
  if (value === "APPROVED") return "Approved";
  if (value === "REJECTED") return "Rejected";
  if (value === "PENDING") return "Pending";
  return value || "-";
};

const ProductApplications = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, total_pages: 1 });
  const [workingId, setWorkingId] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [page, setPage] = useState(1);
  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getProductApplications({ status: statusFilter, page, limit });
      setRows(Array.isArray(res?.data?.data) ? res.data.data : []);
      setMeta(res?.data?.meta || { page: 1, limit, total: 0, total_pages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load product applications.");
    } finally {
      setLoading(false);
    }
  }, [limit, page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const projectOptions = useMemo(() => {
    const unique = [...new Set(rows.map((row) => row?.projects?.title).filter(Boolean))];
    return ["ALL", ...unique];
  }, [rows]);

  const productOptions = useMemo(() => {
    const unique = [...new Set(rows.map((row) => row?.project_products?.name).filter(Boolean))];
    return ["ALL", ...unique];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = normalize(search);
    return rows.filter((row) => {
      const projectTitle = row?.projects?.title || "";
      const productName = row?.project_products?.name || "";
      const participant = row?.profiles?.full_name || row?.profiles?.email || "";
      const byProject = projectFilter === "ALL" || projectTitle === projectFilter;
      const byProduct = productFilter === "ALL" || productName === productFilter;
      const bySearch = !term || normalize(projectTitle).includes(term) || normalize(productName).includes(term) || normalize(participant).includes(term);
      return byProject && byProduct && bySearch;
    });
  }, [rows, projectFilter, productFilter, search]);

  const projectSections = useMemo(() => {
    const sections = [];
    const sectionMap = new Map();

    for (const row of filteredRows) {
      const key = String(row?.project_id || "");
      if (!sectionMap.has(key)) {
        sectionMap.set(key, {
          key,
          project_id: row?.project_id || null,
          project: row?.projects?.title || row?.project_id || "-",
          project_budget: toAmount(row?.project_budget),
          project_spent_budget: toAmount(row?.project_spent_budget),
          project_remaining_budget: toAmount(row?.project_remaining_budget),
          requested_total: 0,
          items: []
        });
        sections.push(sectionMap.get(key));
      }

      const section = sectionMap.get(key);
      section.items.push(row);
      section.requested_total += toAmount(row?.requested_amount);
    }

    return sections;
  }, [filteredRows]);

  const onApprove = async (row) => {
    const autoAllocatedBudget = getAutoAllocatedBudget(row);
    setWorkingId(`approve-${row.id}`);
    try {
      await approveProductApplication(row.id, {
        allocated_budget: autoAllocatedBudget
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to approve product application.");
    } finally {
      setWorkingId("");
    }
  };

  const onReject = async (id) => {
    setWorkingId(`reject-${id}`);
    try {
      await rejectProductApplication(id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to reject product application.");
    } finally {
      setWorkingId("");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Product Applications</h1>
          <p>Approve or reject participant applications for project products</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="admin-btn" onClick={() => navigate("/admin/applications")}>Back</button>
          <button type="button" className="admin-btn" onClick={load}>Refresh</button>
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-panel mt-3">
        <h2>Filters</h2>
        <div className="admin-actions" style={{ marginTop: 10, gap: 10 }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search participant, project, product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 340 }}
          />
          <select aria-label="Project filter" className="form-select" style={{ maxWidth: 260 }} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            {projectOptions.map((project) => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
          <select aria-label="Product filter" className="form-select" style={{ maxWidth: 260 }} value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
            {productOptions.map((product) => (
              <option key={product} value={product}>{product}</option>
            ))}
          </select>
          <select aria-label="Status filter" className="form-select" style={{ maxWidth: 220 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ALL">All</option>
          </select>
        </div>
      </section>

      <section className="mt-3" style={{ display: "grid", gap: 14 }}>
        {loading ? (
          <section className="admin-panel admin-table-wrap"><p className="admin-empty">Loading product applications...</p></section>
        ) : projectSections.length ? (
          projectSections.map((section) => (
            <section key={section.key} className="admin-panel admin-table-wrap">
              <div
                className="admin-actions"
                style={{
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 10,
                  padding: "4px 6px"
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 20 }}>{section.project}</h2>
                  <p style={{ margin: "4px 0 0", color: "#64748b" }}>
                    {section.items.length} request{section.items.length !== 1 ? "s" : ""} in this project
                  </p>
                </div>
                <div className="admin-actions" style={{ gap: 16 }}>
                  <div><strong>Allocated:</strong> {formatCurrency(section.project_budget)}</div>
                  <div><strong>Spent:</strong> {formatCurrency(section.project_spent_budget)}</div>
                  <div><strong>Remaining:</strong> {formatCurrency(section.project_remaining_budget)}</div>
                  <div><strong>Requested:</strong> {formatCurrency(section.requested_total)}</div>
                </div>
              </div>

              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Email</th>
                    <th>Product</th>
                    <th>Product URL</th>
                    <th>Requested (INR)</th>
                    <th>Allocated (Auto)</th>
                    <th>Requested At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((row) => (
                    <tr key={row.id}>
                      <td>{row?.profiles?.full_name || row?.participant_id || "-"}</td>
                      <td>{row?.profiles?.email || "-"}</td>
                      <td>{row?.project_products?.name || row?.product_id || "-"}</td>
                      <td>
                        {row?.project_products?.product_url ? (
                          <a href={row.project_products.product_url} target="_blank" rel="noreferrer">Open</a>
                        ) : "-"}
                      </td>
                      <td>{formatCurrency(row?.requested_amount)}</td>
                      <td style={{ maxWidth: 170, fontWeight: 600 }}>
                        {formatCurrency(getAutoAllocatedBudget(row))}
                      </td>
                      <td>{row?.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                      <td>
                      {String(row?.status || "").toUpperCase() === "PENDING" ? (
                        <div className="admin-actions">
                          <button
                            type="button"
                            className="admin-btn"
                              onClick={() => onApprove(row)}
                              disabled={
                                workingId === `approve-${row.id}`
                                || getAutoAllocatedBudget(row) <= 0
                                || getAutoAllocatedBudget(row) > toAmount(row?.project_remaining_budget)
                              }
                            >
                              Approve
                            </button>
                            <button type="button" className="admin-btn" onClick={() => onReject(row.id)} disabled={workingId === `reject-${row.id}`}>Reject</button>
                          </div>
                        ) : formatStatusLabel(row?.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        ) : (
          <section className="admin-panel admin-table-wrap"><p className="admin-empty">No product applications for selected status.</p></section>
        )}

        {Number(meta.total_pages || 1) > 1 ? (
          <div
            className="admin-actions"
            style={{ justifyContent: "space-between", marginTop: 12, alignItems: "center" }}
          >
            <span style={{ color: "#64748b", fontSize: 14 }}>
              Showing page {meta.page || page} of {meta.total_pages || 1} ({meta.total || 0} total)
            </span>
            <div className="admin-actions">
              <button
                type="button"
                className="admin-btn"
                disabled={loading || page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={loading || page >= Number(meta.total_pages || 1)}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default ProductApplications;
