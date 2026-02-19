import { Outlet, Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";

const BrandLayout = () => {
  return (
    <div>
      <Navbar />
      <nav>
        <Link to="/brand/dashboard">Dashboard</Link> |{" "}
        <Link to="/brand/projects">Projects</Link> |{" "}
        <Link to="/brand/analytics">Analytics</Link>
      </nav>
      <div style={{ padding: 20 }}>
        <Outlet />
      </div>
    </div>
  );
};

export default BrandLayout;