import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { clearStoredTokens, getStoredToken, verifyBackendUser } from "./lib/auth";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import SuperAdminDashboard from "./pages/superAdmin/Dashboard";
import AdminDashboard from "./pages/admin/Dashboard";
import ParticipantDashboard from "./pages/participant/Dashboard";
import ParticipantMarketplace from "./pages/participant/Marketplace";
import Projects from "./pages/brand/Projects";
import ProjectDetails from "./pages/brand/ProjectDetails";
import BrandDashboard from "./pages/brand/Dashboard";
import BrandAnalytics from "./pages/brand/Analytics";
import MyAllocations from "./pages/participant/MyAllocations";
import SubmitFeedback from "./pages/participant/SubmitFeedback";
import SubmitReview from "./pages/participant/SubmitReview";
import UploadProof from "./pages/participant/UploadProof";
import PaymentDetails from "./pages/participant/PaymentDetails";
import Profile from "./pages/participant/Profile";
import UploadSection from "./pages/participant/UploadSection";
import RecentHistory from "./pages/participant/RecentHistory";
import Verification from "./pages/admin/Verification";
import Payouts from "./pages/admin/Payouts";
import PayoutHistory from "./pages/admin/PayoutHistory";
import CreateBatch from "./pages/admin/CreateBatch";
import ApplicationApprovals from "./pages/admin/ApplicationApprovals";
import LoginRequests from "./pages/admin/LoginRequests";
import ProjectUnlockRequests from "./pages/admin/ProjectUnlockRequests";
import ProductApplications from "./pages/admin/ProductApplications";
import AllRequests from "./pages/admin/AllRequests";
import PayoutStatus from "./pages/participant/PayoutStatus";
import Users from "./pages/superAdmin/Users";
import ParticipantDetails from "./pages/superAdmin/ParticipantDetails";
import Reports from "./pages/superAdmin/Reports";
import Brands from "./pages/superAdmin/Brands";
import AuditLogs from "./pages/superAdmin/AuditLogs";
import CreateProject from "./pages/admin/CreateProject";
import Support from "./pages/superAdmin/Support";

const RoleRoute = ({ allowedRoles, children }) => {
  const token = getStoredToken();
  const [isChecking, setIsChecking] = useState(true);
  const [role, setRole] = useState("");

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      if (!token) {
        if (mounted) {
          setRole("");
          setIsChecking(false);
        }
        return;
      }

      try {
        const user = await verifyBackendUser(token);
        if (mounted) {
          setRole(String(user?.role || "").toUpperCase());
        }
      } catch {
        if (mounted) {
          clearStoredTokens();
          setRole("");
        }
      } finally {
        if (mounted) {
          setIsChecking(false);
        }
      }
    };

    check();
    return () => {
      mounted = false;
    };
  }, [token]);

  if (isChecking) {
    return <div className="admin-loading">Checking access...</div>;
  }

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const DashboardRoute = () => {
  const token = getStoredToken();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const checkRole = async () => {
      if (!token) {
        if (isMounted) {
          setUser(null);
          setIsChecking(false);
        }
        return;
      }

      try {
        const me = await verifyBackendUser(token);
        const nextRole = me?.role?.toUpperCase?.() || "";

        if (!isMounted) {
          return;
        }

        setUser({ ...me, role: nextRole });
      } catch {
        if (isMounted) {
          clearStoredTokens();
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    checkRole();

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (isChecking) {
    return <div className="admin-loading">Checking access...</div>;
  }

  if (!user?.role) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "ADMIN") {
    return <Navigate to={`/admin/${user.id}/dashboard`} replace />;
  }

  if (user.role === "SUPER_ADMIN") {
    return <Navigate to={`/super-admin/${user.id}/dashboard`} replace />;
  }

  if (user.role === "PARTICIPANT") {
    return <Navigate to={`/participant/${user.id}/dashboard`} replace />;
  }

  if (user.role === "BRAND") {
    return <BrandDashboard />;
  }

  clearStoredTokens();
  return <Navigate to="/login" replace />;
};

const AdminDashboardRoute = () => {
  const { id } = useParams();
  const token = getStoredToken();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      if (!token) {
        if (mounted) setIsChecking(false);
        return;
      }

      try {
        const me = await verifyBackendUser(token);
        if (mounted) setUser(me);
      } catch {
        if (mounted) {
          clearStoredTokens();
          setUser(null);
        }
      } finally {
        if (mounted) setIsChecking(false);
      }
    };

    check();
    return () => {
      mounted = false;
    };
  }, [token]);

  if (isChecking) return <div className="admin-loading">Checking access...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (String(user.role || "").toUpperCase() !== "ADMIN") return <Navigate to="/dashboard" replace />;
  if (id !== user.id) return <Navigate to={`/admin/${user.id}/dashboard`} replace />;

  return <AdminDashboard />;
};

const SuperAdminDashboardRoute = () => {
  const { id } = useParams();
  const token = getStoredToken();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      if (!token) {
        if (mounted) setIsChecking(false);
        return;
      }

      try {
        const me = await verifyBackendUser(token);
        if (mounted) setUser(me);
      } catch {
        if (mounted) {
          clearStoredTokens();
          setUser(null);
        }
      } finally {
        if (mounted) setIsChecking(false);
      }
    };

    check();
    return () => {
      mounted = false;
    };
  }, [token]);

  if (isChecking) return <div className="admin-loading">Checking access...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (String(user.role || "").toUpperCase() !== "SUPER_ADMIN") return <Navigate to="/dashboard" replace />;
  if (id !== user.id) return <Navigate to={`/super-admin/${user.id}/dashboard`} replace />;

  return <SuperAdminDashboard />;
};

const ParticipantDashboardRoute = () => {
  const { id } = useParams();
  const token = getStoredToken();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      if (!token) {
        if (mounted) setIsChecking(false);
        return;
      }

      try {
        const me = await verifyBackendUser(token);
        if (mounted) setUser(me);
      } catch {
        if (mounted) {
          clearStoredTokens();
          setUser(null);
        }
      } finally {
        if (mounted) setIsChecking(false);
      }
    };

    check();
    return () => {
      mounted = false;
    };
  }, [token]);

  if (isChecking) return <div className="admin-loading">Checking access...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (String(user.role || "").toUpperCase() !== "PARTICIPANT") return <Navigate to="/dashboard" replace />;
  if (id !== user.id) return <Navigate to={`/participant/${user.id}/dashboard`} replace />;

  return <ParticipantDashboard />;
};

const ParticipantScopedRoute = ({ children }) => {
  const { id } = useParams();
  const token = getStoredToken();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      if (!token) {
        if (mounted) setIsChecking(false);
        return;
      }

      try {
        const me = await verifyBackendUser(token);
        if (mounted) setUser(me);
      } catch {
        if (mounted) {
          clearStoredTokens();
          setUser(null);
        }
      } finally {
        if (mounted) setIsChecking(false);
      }
    };

    check();
    return () => {
      mounted = false;
    };
  }, [token]);

  if (isChecking) return <div className="admin-loading">Checking access...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (String(user.role || "").toUpperCase() !== "PARTICIPANT") return <Navigate to="/dashboard" replace />;
  if (id !== user.id) return <Navigate to={`/participant/${user.id}/dashboard`} replace />;

  return children;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<DashboardRoute />} />
      <Route path="/admin/:id/dashboard" element={<AdminDashboardRoute />} />
      <Route path="/super-admin/:id/dashboard" element={<SuperAdminDashboardRoute />} />
      <Route
        path="/participant/:id/dashboard"
        element={(
          <ParticipantScopedRoute>
            <ParticipantDashboardRoute />
          </ParticipantScopedRoute>
        )}
      />
      <Route
        path="/participant/:id/marketplace"
        element={(
          <ParticipantScopedRoute>
            <ParticipantMarketplace />
          </ParticipantScopedRoute>
        )}
      />
      <Route
        path="/projects/manage"
        element={(
          <RoleRoute allowedRoles={["ADMIN", "SUPER_ADMIN", "BRAND"]}>
            <Projects />
          </RoleRoute>
        )}
      />
      <Route
        path="/projects/manage/:projectId"
        element={(
          <RoleRoute allowedRoles={["ADMIN", "SUPER_ADMIN", "BRAND"]}>
            <ProjectDetails />
          </RoleRoute>
        )}
      />
      <Route
        path="/projects/create"
        element={(
          <RoleRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
            <CreateProject />
          </RoleRoute>
        )}
      />
      <Route
        path="/brand/dashboard"
        element={(
          <RoleRoute allowedRoles={["BRAND"]}>
            <BrandDashboard />
          </RoleRoute>
        )}
      />
      <Route
        path="/brand/projects"
        element={(
          <RoleRoute allowedRoles={["BRAND"]}>
            <Projects />
          </RoleRoute>
        )}
      />
      <Route
        path="/brand/analytics"
        element={(
          <RoleRoute allowedRoles={["BRAND"]}>
            <BrandAnalytics />
          </RoleRoute>
        )}
      />
      <Route
        path="/admin/verification"
        element={(
          <RoleRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
            <Verification />
          </RoleRoute>
        )}
      />
      <Route
        path="/super-admin/users"
        element={(
          <RoleRoute allowedRoles={["SUPER_ADMIN"]}>
            <Users />
          </RoleRoute>
        )}
      />
      <Route
        path="/super-admin/participants/:participantId"
        element={(
          <RoleRoute allowedRoles={["SUPER_ADMIN"]}>
            <ParticipantDetails />
          </RoleRoute>
        )}
      />
      <Route
        path="/super-admin/brands"
        element={(
          <RoleRoute allowedRoles={["SUPER_ADMIN"]}>
            <Brands />
          </RoleRoute>
        )}
      />
      <Route
        path="/super-admin/reports"
        element={(
          <RoleRoute allowedRoles={["SUPER_ADMIN"]}>
            <Reports />
          </RoleRoute>
        )}
      />
      <Route
        path="/super-admin/logs"
        element={(
          <RoleRoute allowedRoles={["SUPER_ADMIN"]}>
            <AuditLogs />
          </RoleRoute>
        )}
      />
      <Route
        path="/super-admin/support"
        element={(
          <RoleRoute allowedRoles={["SUPER_ADMIN"]}>
            <Support />
          </RoleRoute>
        )}
      />
      <Route
        path="/admin/applications"
        element={(
          <RoleRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
            <ApplicationApprovals />
          </RoleRoute>
        )}
      />
      <Route
        path="/admin/applications/login-requests"
        element={(
          <RoleRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
            <LoginRequests />
          </RoleRoute>
        )}
      />
      <Route
        path="/admin/applications/project-unlock-requests"
        element={(
          <RoleRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
            <ProjectUnlockRequests />
          </RoleRoute>
        )}
      />
      <Route
        path="/admin/applications/product-applications"
        element={(
          <RoleRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
            <ProductApplications />
          </RoleRoute>
        )}
      />
      <Route
        path="/admin/applications/all-requests"
        element={(
          <RoleRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
            <AllRequests />
          </RoleRoute>
        )}
      />
      <Route
        path="/admin/payouts"
        element={(
          <RoleRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
            <Payouts />
          </RoleRoute>
        )}
      />
      <Route
        path="/admin/payout-history"
        element={(
          <RoleRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
            <PayoutHistory />
          </RoleRoute>
        )}
      />
      <Route
        path="/admin/payouts/create-batch"
        element={(
          <RoleRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
            <CreateBatch />
          </RoleRoute>
        )}
      />
      <Route
        path="/participant/:id/allocation/active"
        element={(
          <ParticipantScopedRoute>
            <MyAllocations />
          </ParticipantScopedRoute>
        )}
      />
      <Route
        path="/participant/:id/payouts"
        element={(
          <ParticipantScopedRoute>
            <PayoutStatus />
          </ParticipantScopedRoute>
        )}
      />
      <Route path="/allocations/active" element={<Navigate to="/dashboard" replace />} />
      <Route path="/participant/payouts" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/participant/:id/upload-proof/:allocationId?"
        element={(
          <ParticipantScopedRoute>
            <UploadProof />
          </ParticipantScopedRoute>
        )}
      />
      <Route
        path="/participant/:id/payment-details"
        element={(
          <ParticipantScopedRoute>
            <PaymentDetails />
          </ParticipantScopedRoute>
        )}
      />
      <Route
        path="/participant/:id/submit-feedback/:allocationId?"
        element={(
          <ParticipantScopedRoute>
            <SubmitFeedback />
          </ParticipantScopedRoute>
        )}
      />
      <Route
        path="/participant/:id/submit-review/:allocationId?"
        element={(
          <ParticipantScopedRoute>
            <SubmitReview />
          </ParticipantScopedRoute>
        )}
      />
      <Route
        path="/participant/:id/profile"
        element={(
          <ParticipantScopedRoute>
            <Profile />
          </ParticipantScopedRoute>
        )}
      />
      <Route
        path="/participant/:id/uploads"
        element={(
          <ParticipantScopedRoute>
            <UploadSection />
          </ParticipantScopedRoute>
        )}
      />
      <Route
        path="/participant/:id/recent-history"
        element={(
          <ParticipantScopedRoute>
            <RecentHistory />
          </ParticipantScopedRoute>
        )}
      />
      <Route path="/participant/upload-proof" element={<Navigate to="/dashboard" replace />} />
      <Route path="/participant/submit-feedback" element={<Navigate to="/dashboard" replace />} />
      <Route path="/participant/submit-review" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
