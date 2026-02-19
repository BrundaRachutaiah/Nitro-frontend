import { useEffect, useState } from "react";

const CountdownTimer = ({ expiryDate }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date(expiryDate) - new Date();
      if (diff <= 0) {
        setTimeLeft("Expired");
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        setTimeLeft(`${days} days left`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiryDate]);

  return <span>{timeLeft}</span>;
};

export default CountdownTimer;