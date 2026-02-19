import axios from "./axiosInstance";

export const getEligiblePayouts = () =>
  axios.get("/admin/payouts/eligible");

export const createBatch = (data) =>
  axios.post("/admin/payout-batches", data);

export const getBatches = () =>
  axios.get("/admin/payout-batches");

export const markBatchPaid = (id) =>
  axios.patch(`/admin/payout-batches/${id}/mark-paid`);

export const exportBatchCSV = (id) => axios.get(
  `/admin/payout-batches/${id}/export`,
  { responseType: "blob" }
);
