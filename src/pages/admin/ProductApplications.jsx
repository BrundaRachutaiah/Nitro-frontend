import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  approveProductApplication,
  getProductApplications,
  rejectProductApplication
} from "../../api/admin.api";

const normalize = (value) => String(value || "").trim().toLowerCase();

const ProductApplications = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [workingId, setWorkingId] = useState("");
  const [budgetById, setBudgetById] = useState({});
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getProductApplications({ status: statusFilter });
      setRows(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load product applications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
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

  const onApprove = async (id) => {
    setWorkingId(`approve-${id}`);
    try {
      await approveProductApplication(id, {
        allocated_budget: Number(budgetById[id] || 0)
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
          <select className="form-select" style={{ maxWidth: 260 }} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            {projectOptions.map((project) => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
          <select className="form-select" style={{ maxWidth: 260 }} value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
            {productOptions.map((product) => (
              <option key={product} value={product}>{product}</option>
            ))}
          </select>
          <select className="form-select" style={{ maxWidth: 220 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ALL">All</option>
          </select>
        </div>
      </section>

      <section className="admin-panel admin-table-wrap mt-3">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Participant</th>
              <th>Email</th>
              <th>Project</th>
              <th>Product</th>
              <th>Product URL</th>
              <th>Allocated Budget (INR)</th>
              <th>Requested At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>Loading product applications...</td></tr>
            ) : filteredRows.length ? (
              filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>{row?.profiles?.full_name || row?.participant_id}</td>
                  <td>{row?.profiles?.email || "-"}</td>
                  <td>{row?.projects?.title || row?.project_id}</td>
                  <td>{row?.project_products?.name || row?.product_id}</td>
                  <td>
                    {row?.project_products?.product_url ? (
                      <a href={row.project_products.product_url} target="_blank" rel="noreferrer">Open</a>
                    ) : "-"}
                  </td>
                  <td style={{ maxWidth: 170 }}>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={budgetById[row.id] ?? ""}
                      onChange={(e) => setBudgetById((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      placeholder="0"
                    />
                  </td>
                  <td>{row?.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                  <td>
                    {String(row?.status || "").toUpperCase() === "PENDING" ? (
                      <div className="admin-actions">
                        <button type="button" className="admin-btn" onClick={() => onApprove(row.id)} disabled={workingId === `approve-${row.id}`}>Approve</button>
                        <button type="button" className="admin-btn" onClick={() => onReject(row.id)} disabled={workingId === `reject-${row.id}`}>Reject</button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={8} className="admin-empty">No product applications for selected status.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default ProductApplications;
