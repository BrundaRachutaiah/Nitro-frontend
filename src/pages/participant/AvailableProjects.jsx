import { useEffect, useState } from "react";
import { getAvailableProjects } from "../../api/project.api";
import ProjectCard from "../../components/project/ProjectCard";

const AvailableProjects = () => {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    getAvailableProjects().then((res) => setProjects(res.data));
  }, []);

  return (
    <div>
      <h2>Available Projects</h2>
      {projects.map((p) => (
        <ProjectCard key={p._id} project={p} />
      ))}
    </div>
  );
};

export default AvailableProjects;