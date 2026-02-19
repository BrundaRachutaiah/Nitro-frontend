import axios from "./axiosInstance";

export const getBrandProjects = () =>
  axios.get("/brand/projects");

export const getBrandAnalytics = () =>
  axios.get("/brand/analytics");

export const updateProjectStatus = (projectId, status) =>
  axios.patch(`/projects/${projectId}/status`, { status });

export const updateProject = (projectId, payload) =>
  axios.patch(`/projects/${projectId}`, payload);
