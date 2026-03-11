const isPdfUrl = (url) => {
  try {
    const normalized = String(url || "").toLowerCase();
    const clean = normalized.split("?")[0].split("#")[0];
    return clean.endsWith(".pdf");
  } catch {
    return false;
  }
};

const ProofReview = ({ proofUrl }) => {
  if (!proofUrl) {
    return <span style={{ color: "var(--text-3)" }}>-</span>;
  }

  if (isPdfUrl(proofUrl)) {
    return (
      <a
        href={proofUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          minWidth: 120,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(239,68,68,0.28)",
          background: "rgba(127,29,29,0.14)",
          color: "#fecaca",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: "0.82rem"
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "rgba(239,68,68,0.18)",
            color: "#fca5a5",
            fontSize: "0.72rem",
            fontWeight: 800,
            letterSpacing: "0.04em"
          }}
        >
          PDF
        </span>
        <span>Open File</span>
      </a>
    );
  }

  return (
    <a href={proofUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block" }}>
      <img
        className="proof-thumb"
        src={proofUrl}
        alt="Proof"
        style={{
          width: 88,
          height: 56,
          borderRadius: 10,
          objectFit: "cover",
          border: "1px solid rgba(148,163,184,0.28)",
          background: "rgba(15,23,42,0.5)",
          display: "block"
        }}
      />
    </a>
  );
};

export default ProofReview;
