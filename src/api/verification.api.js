import axios from "./axiosInstance";

export const getPendingPurchaseProofs = () =>
  axios.get("/admin/purchase-proofs/pending");

export const approvePurchaseProof = (id) =>
  axios.patch(`/admin/purchase-proofs/${id}/approve`);

export const rejectPurchaseProof = (id) =>
  axios.patch(`/admin/purchase-proofs/${id}/reject`);

export const approveProof = (id) => approvePurchaseProof(id);
export const rejectProof = (id) => rejectPurchaseProof(id);

export const uploadPurchaseProof = (allocationId, formData, productId = "") => {
  if (!formData.has("allocationId")) {
    formData.append("allocationId", allocationId);
  }
  if (productId && !formData.has("productId")) {
    formData.append("productId", productId);
  }

  return axios.post("/uploads/purchase-proof", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
};
