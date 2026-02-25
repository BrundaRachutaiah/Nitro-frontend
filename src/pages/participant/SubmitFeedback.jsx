import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

const SubmitFeedback = () => {
  const navigate = useNavigate();
  const { id, allocationId } = useParams();

  useEffect(() => {
    if (id && allocationId) {
      navigate(`/participant/${id}/submit-review/${allocationId}`, { replace: true });
      return;
    }

    if (id) {
      navigate(`/participant/${id}/submit-review`, { replace: true });
      return;
    }

    navigate("/dashboard", { replace: true });
  }, [allocationId, id, navigate]);

  return null;
};

export default SubmitFeedback;
