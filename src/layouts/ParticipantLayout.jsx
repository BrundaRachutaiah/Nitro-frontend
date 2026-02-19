import { Outlet, Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";

const ParticipantLayout = () => {
  return (
    <div>
      <Navbar />
      <nav>
        <Link to="/participant/dashboard">Dashboard</Link> |{" "}
        <Link to="/participant/projects">Projects</Link> |{" "}
        <Link to="/participant/allocations">My Allocations</Link> |{" "}
        <Link to="/participant/payouts">Payouts</Link>
      </nav>
      <div style={{ padding: 20 }}>
        <Outlet />
      </div>
    </div>
  );
};

export default ParticipantLayout;