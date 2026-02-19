const ProofReview = ({ proofUrl }) => {
  return (
    <a href={proofUrl} target="_blank" rel="noreferrer">
      <img className="proof-thumb" src={proofUrl} width="200" />
    </a>
  );
};

export default ProofReview;
