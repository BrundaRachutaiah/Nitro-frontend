import { useNavigate } from "react-router-dom";
import ProjectForm from "../../components/project/ProjectForm";
import "../superAdmin/AdminPages.css";

const CreateProject = () => {
  const navigate = useNavigate();

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Create Project</h1>
          <p>Set campaign mode, units, and timeline</p>
        </div>
        <div className="admin-head-actions">
          <button className="admin-btn" onClick={() => navigate("/projects/manage")}>Back to Projects</button>
        </div>
      </div>
      <section className="admin-panel">
        <ProjectForm />
      </section>
    </div>
  );
};

export default CreateProject;
