import { exportBatchCSV } from "../../api/payout.api";
import Table from "../common/Table";
import "../../pages/superAdmin/AdminPages.css";

const BatchTable = ({ batches }) => {
  const handleExport = async (id) => {
    const res = await exportBatchCSV(id);
    const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payout_batch_${id}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const columns = ["id", "total_amount", "status", "created_at"];

  return (
    <div className="admin-panel">
      <div className="admin-table-wrap">
        <Table columns={columns} data={batches} />
      </div>
      <div className="admin-actions" style={{ marginTop: 12, flexWrap: "wrap" }}>
        {batches.map((batch) => (
          <button className="admin-btn" key={batch.id} onClick={() => handleExport(batch.id)}>
            Export {batch.id}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BatchTable;
