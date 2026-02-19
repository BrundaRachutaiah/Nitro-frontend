import { useEffect, useState } from "react";
import { getBrandAnalytics } from "../../api/brand.api";

const Analytics = () => {
  const [data, setData] = useState({});

  useEffect(() => {
    getBrandAnalytics().then((res) => setData(res.data?.data || {}));
  }, []);

  return (
    <div>
      <h2>Analytics</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default Analytics;
