import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const Sidebar = () => {
  const { user } = useAuth();

  return (
    <div style={{ width: "200px", background: "#eee" }}>
      <h3>Menu</h3>

      {(user.role?.toUpperCase() === "ADMIN" || user.role?.toUpperCase() === "SUPER_ADMIN") && (
        <>
          <Link to="/admin/dashboard">Dashboard</Link><br/>
          <Link to="/admin/projects">Projects</Link><br/>
          <Link to="/admin/payouts">Payouts</Link><br/>
          <Link to="/admin/payout-history">Payout History</Link>
        </>
      )}

      {user.role?.toUpperCase() === "PARTICIPANT" && (
        <>
          <Link to="/participant/dashboard">Dashboard</Link><br/>
          <Link to="/participant/projects">Projects</Link>
        </>
      )}
    </div>
  );
};

export default Sidebar;
