import { createBrowserRouter } from "react-router-dom";
import Login from "../pages/auth/Login";
import AdminLayout from "../layouts/AdminLayout";
import BrandLayout from "../layouts/BrandLayout";
import ParticipantLayout from "../layouts/ParticipantLayout";
import SuperAdminLayout from "../layouts/SuperAdminLayout";
import ProtectedRoute from "./ProtectedRoute";
import RoleGuard from "./RoleGuard";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },

  {
    path: "/admin",
    element: (
      <ProtectedRoute>
        <RoleGuard allowedRoles={["ADMIN"]}>
          <AdminLayout />
        </RoleGuard>
      </ProtectedRoute>
    ),
  },

  {
    path: "/brand",
    element: (
      <ProtectedRoute>
        <RoleGuard allowedRoles={["BRAND"]}>
          <BrandLayout />
        </RoleGuard>
      </ProtectedRoute>
    ),
  },

  {
    path: "/participant",
    element: (
      <ProtectedRoute>
        <RoleGuard allowedRoles={["PARTICIPANT"]}>
          <ParticipantLayout />
        </RoleGuard>
      </ProtectedRoute>
    ),
  },

  {
    path: "/super-admin",
    element: (
      <ProtectedRoute>
        <RoleGuard allowedRoles={["SUPER_ADMIN"]}>
          <SuperAdminLayout />
        </RoleGuard>
      </ProtectedRoute>
    ),
  },
]);