import { useNavigate } from "react-router-dom";
import "./RoleSelection.css";

const RoleSelection = () => {
  const navigate = useNavigate();

  return (
    <div className="role-select-page">
      <div className="role-select-shell">
        <header className="role-select-head">
          <h1>Nitro</h1>
          <p>Select how you want to sign in</p>
        </header>

        <section className="role-select-grid">
          <button
            type="button"
            className="role-select-card"
            onClick={() => navigate("/login/admin")}
          >
            <h2>Admin Login</h2>
            <p>For Admin and Super Admin access</p>
          </button>

          <button
            type="button"
            className="role-select-card"
            onClick={() => navigate("/login/participant")}
          >
            <h2>Participant Login</h2>
            <p>For participant sign in and registration</p>
          </button>
        </section>
      </div>
    </div>
  );
};

export default RoleSelection;
