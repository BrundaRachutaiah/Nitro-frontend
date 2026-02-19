export const isAdmin = (role) =>
  role === "ADMIN" || role === "SUPER_ADMIN";

export const isParticipant = (role) =>
  role === "PARTICIPANT";

export const isBrand = (role) =>
  role === "BRAND";
