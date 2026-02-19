import { useEffect, useState } from "react";
import { getBrandAnalytics } from "../../api/brand.api";

const Dashboard = () => {
  const [analytics, setAnalytics] = useState({
    projects_total: 0,
    applications_total: 0,
    allocations_total: 0
  });

  useEffect(() => {
    getBrandAnalytics().then((res) => setAnalytics(res.data?.data || {}));
  }, []);

  return (
    <div>
      <h2>Brand Dashboard</h2>
      <p>Overview of brand campaigns</p>
      <ul>
        <li>Total Projects: {analytics.projects_total || 0}</li>
        <li>Total Applications: {analytics.applications_total || 0}</li>
        <li>Total Allocations: {analytics.allocations_total || 0}</li>
      </ul>
    </div>
  );
};

export default Dashboard;
