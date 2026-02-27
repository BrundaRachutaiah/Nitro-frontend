import axios from "./axiosInstance";

export const getAllocations = () =>
  axios.get("/allocations/active");

export const getMyAllocations = () =>
  axios.get("/allocations/my");

export const getMyAllocationTracking = (config = {}) =>
  axios.get("/allocations/my/tracking", config);

export const applyForProject = (projectId, payload) =>
  axios.post(`/projects/${projectId}/apply`, payload);

export const getMyApplications = () =>
  axios.get("/applications/my");

export const markApplicationPurchased = (applicationId) =>
  axios.patch(`/applications/${applicationId}/purchased`);

export const getPaymentDetails = () =>
  axios.get("/applications/payment-details");

export const savePaymentDetails = (payload) =>
  axios.put("/applications/payment-details", payload);

export const updateAllocationStatus = (allocationId, status) =>
  axios.patch(`/allocations/${allocationId}/status`, { status });
