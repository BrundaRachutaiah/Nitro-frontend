import { useEffect, useState } from "react";
import { getAllocations } from "../../api/allocation.api";
import Table from "../../components/common/Table";

const Allocations = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    getAllocations().then((res) => setData(res.data));
  }, []);

  return (
    <div>
      <h2>Allocations</h2>
      <Table columns={["user", "project", "status"]} data={data} />
    </div>
  );
};

export default Allocations;