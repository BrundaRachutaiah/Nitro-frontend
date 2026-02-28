import axios from "./axiosInstance";

export const getEligiblePayouts = (params = {}) =>
  axios.get("/admin/payouts/eligible", { params });

export const createBatch = (data) =>
  axios.post("/admin/payout-batches", data);

export const getBatches = (params = {}) =>
  axios.get("/admin/payout-batches", { params });

export const markBatchPaid = (id) =>
  axios.patch(`/admin/payout-batches/${id}/mark-paid`);

export const exportBatchCSV = (id) => axios.get(
  `/admin/payout-batches/${id}/export`,
  { responseType: "blob" }
);

export const exportBatchesCSV = ({ status = "ALL", batchIds = [] } = {}) => axios.get(
  "/admin/payout-batches/export",
  {
    params: {
      status,
      ...(Array.isArray(batchIds) && batchIds.length ? { batch_ids: batchIds.join(",") } : {})
    },
    responseType: "blob"
  }
);

// Per-participant payout actions
export const exportPayoutCSV = (payoutId) => axios.get(
  `/admin/payouts/${payoutId}/export`,
  { responseType: "blob" }
);

export const markPayoutPaid = (payoutId) =>
  axios.patch(`/admin/payouts/${payoutId}/mark-paid`);