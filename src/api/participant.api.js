import axios from "./axiosInstance";

export const submitFeedback = (data) =>
  axios.post("/feedback", data);

export const submitReview = (data) =>
  axios.post("/review", data);

export const uploadReviewProof = (allocationId, formData, productId = "") => {
  if (!formData.has("allocationId")) {
    formData.append("allocationId", allocationId);
  }
  if (productId && !formData.has("productId")) {
    formData.append("productId", productId);
  }

  return axios.post("/uploads/review-proof", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
};

export const uploadReviewProofs = (allocationId, formData, productId = "") => {
  if (!formData.has("allocationId")) {
    formData.append("allocationId", allocationId);
  }
  if (productId && !formData.has("productId")) {
    formData.append("productId", productId);
  }

  return axios.post("/uploads/review-proofs", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
};

export const getPendingReviews = () =>
  axios.get("/admin/reviews/pending");

export const approveReview = (id) =>
  axios.patch(`/admin/reviews/${id}/approve`);

export const rejectReview = (id) =>
  axios.patch(`/admin/reviews/${id}/reject`);
