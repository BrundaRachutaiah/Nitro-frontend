import axios from "./axiosInstance";

export const loginUser = (data) =>
  axios.post("/auth/login", data);

export const getMe = () =>
  axios.get("/auth/me");