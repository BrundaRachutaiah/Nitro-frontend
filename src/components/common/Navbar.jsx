import { useAuth } from "../../context/AuthContext";

const Navbar = () => {
  const { logout } = useAuth();

  return (
    <div style={{ background: "#ddd", padding: "10px" }}>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

export default Navbar;