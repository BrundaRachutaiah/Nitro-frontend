import axios from "./axiosInstance";

export const getMyProfile = () =>
  axios.get("/users/me");

export const updateMyProfile = (payload) =>
  axios.patch("/users/me", payload);

