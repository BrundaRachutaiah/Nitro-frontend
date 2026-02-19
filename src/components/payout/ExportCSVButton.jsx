import { exportBatchCSV } from "../../api/payout.api";

const ExportCSVButton = ({ batchId }) => {
  const handleExport = async () => {
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
  };

  return <button onClick={handleExport}>Export CSV</button>;
};

export default ExportCSVButton;
