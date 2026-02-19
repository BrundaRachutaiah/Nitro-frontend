import { useEffect, useState } from "react";
import { getAllParticipants } from "../../api/admin.api";
import Table from "../../components/common/Table";

const Participents = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    getAllParticipants().then((res) => setUsers(res.data));
  }, []);

  return (
    <div>
      <h2>Participants</h2>
      <Table columns={["name", "email", "status"]} data={users} />
    </div>
  );
};

export default Participents;