export const formatDate = (date) =>
  new Date(date).toLocaleDateString();

export const isExpired = (date) =>
  new Date(date) < new Date();