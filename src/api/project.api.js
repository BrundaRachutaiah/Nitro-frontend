import axios from "./axiosInstance";

export const createProject = (data) =>
  axios.post("/projects", data);

export const getProjects = () =>
  axios.get("/projects");

export const getAvailableProjects = (params = {}) =>
  axios.get("/projects/available", { params });

export const getActiveCatalog = (params = {}) =>
  axios.get("/projects/catalog", { params });

export const requestProjectAccess = (projectId) =>
  axios.post(`/projects/${projectId}/request-access`);

export const getProjectProducts = (projectId) =>
  axios.get(`/projects/${projectId}/products`);

export const getProjectById = (projectId) =>
  axios.get(`/projects/${projectId}`);
