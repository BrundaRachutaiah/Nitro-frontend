import axios from "./axiosInstance";

export const getDashboardStats = () =>
  axios.get("/admin/dashboard/summary");

export const getAllParticipants = () =>
  axios.get("/admin/participants");

export const getParticipantById = (id) =>
  axios.get(`/admin/participants/${id}`);

export const getPendingParticipants = () =>
  axios.get("/admin/participants/pending");

export const approveParticipant = (id) =>
  axios.patch(`/admin/participants/${id}/approve`);

export const rejectParticipant = (id) =>
  axios.patch(`/admin/participants/${id}/reject`);

export const getPendingProjectAccess = () =>
  axios.get("/admin/project-access/pending");

export const getProjectAccessRequests = (params = {}) =>
  axios.get("/admin/project-access/pending", { params });

export const approveProjectAccess = (id, payload = {}) =>
  axios.patch(`/admin/project-access/${id}/approve`, payload);

export const rejectProjectAccess = (id, payload = {}) =>
  axios.patch(`/admin/project-access/${id}/reject`, payload);

export const getPendingProductApplications = () =>
  axios.get("/admin/applications/pending");

export const getProductApplications = (params = {}) =>
  axios.get("/admin/applications/pending", { params });

export const getApplicationSummary = () =>
  axios.get("/admin/applications/summary");

export const getPayoutReport = (params = {}) =>
  axios.get("/admin/reports/payouts", { params });

export const exportPayoutReportCSV = (params = {}) =>
  axios.get("/admin/reports/payouts/export", { params, responseType: "blob" });

export const approveProductApplication = (id, payload = {}) =>
  axios.patch(`/admin/applications/${id}/approve`, payload);

export const rejectProductApplication = (id, payload = {}) =>
  axios.patch(`/admin/applications/${id}/reject`, payload);
