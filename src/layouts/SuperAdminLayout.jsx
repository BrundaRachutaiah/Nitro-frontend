import { Outlet, Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";

const SuperAdminLayout = () => {
  return (
    <div>
      <Navbar />
      <nav>
        <Link to="/super-admin/users">Users</Link> |{" "}
        <Link to="/super-admin/brands">Brands</Link> |{" "}
        <Link to="/super-admin/logs">Audit Logs</Link>
      </nav>
      <div style={{ padding: 20 }}>
        <Outlet />
      </div>
    </div>
  );
};

export default SuperAdminLayout;