const Badge = ({ status }) => {
  const colors = {
    approved: "green",
    pending: "orange",
    rejected: "red",
    expired: "gray",
  };

  return (
    <span style={{ color: colors[status] }}>
      {status.toUpperCase()}
    </span>
  );
};

export default Badge;