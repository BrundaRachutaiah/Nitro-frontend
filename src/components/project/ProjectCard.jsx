import { applyForProject } from "../../api/allocation.api";

const ProjectCard = ({ project }) => {
  const handleApply = async () => {
    await applyForProject(project._id);
    alert("Applied Successfully");
  };

  return (
    <div>
      <h3>{project.name}</h3>
      <p>Mode: {project.mode}</p>
      <button onClick={handleApply}>Apply</button>
    </div>
  );
};

export default ProjectCard;