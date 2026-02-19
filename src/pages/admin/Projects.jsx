import { useEffect, useState } from "react";
import { getProjects } from "../../api/project.api";
import Table from "../../components/common/Table";

const Projects = () => {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    getProjects().then((res) => setProjects(res.data));
  }, []);

  return (
    <div>
      <h2>Projects</h2>
      <Table columns={["name", "mode", "units"]} data={projects} />
    </div>
  );
};

export default Projects;